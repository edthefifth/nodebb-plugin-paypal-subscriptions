'use strict';

var API;
var winston = require.main.require('winston');
var nconf = require.main.require('nconf');
var meta = require.main.require('./src/meta');
var groups = require.main.require('./src/groups');
var user = require.main.require('./src/user');
var db = require.main.require('./src/database');
var notAllowed = require.main.require('./src/controllers/helpers').notAllowed;
var stripe= {};


stripe.configure = function() {
	meta.settings.get('stripe-subscriptions', function(err, settings) {
		if (!settings.api_key) {
			return winston.warn('[stripe-subscriptions] API Credentials not configured');
		}

		API = require('stripe')(settings.api_key);
    API.setApiVersion('2017-12-14');

	});
};

stripe.isSubscribed = function(uid, callback) {
	
  db.isSortedSetMember('stripe-subscriptions:subscribed', uid, callback);
};

stripe.subscribe = function(req, res, next) {
	if (!req.user) {
		return notAllowed(req, res);
	}

	stripe.isSubscribed(req.user.uid, function(err, isSubscribed) {
		if (isSubscribed) {
			res.redirect('/?subscribe=already-subscribed');
			return;
		}

		meta.settings.get('stripe-subscriptions', function(err, settings) {
			res.render('subscribe', {
				monthly: settings.monthly,
				annually: settings.annually,
				notsetup: (!(settings.monthly && settings.annually || (!settings.api_key)),
				title: "Subscribe"
			});
		});
	});
};

stripe.onSubscribe = function(req, res, next) {
	if (!req.user) {
		return notAllowed(req, res);
	}

	var period = req.body.period;
  var email = req.body.email;

	if (period !== 'Month' && period !== 'Annual') {
		winston.warn('[stripe] Invalid Period')
		return res.redirect('/?subscribe=fail');
	}
  
  if(!email)
  {
    winston.warn('[stripe] Invalid Email')
		return res.redirect('/?subscribe=fail');
  }
  
  API.customers.create(
    { email: email },
    function(err, customer) {
      err; // null if no error occurred
      customer; // the created customer object
    }
  );

	meta.settings.get('stripe-subscriptions', function(err, settings) {
		var url = nconf.get('url');
    req.session.stripeSubscriptionPeriod = req.body.period;
    req.session.stripeCustomerEmail = req.body.email;
    url = url.replace('cgi?bin', 'cgi-bin'); // why? no idea.
	  res.redirect(url);
	
	});
};

stripe.onSuccess = function(req, res, next) {
	if (!req.user) {
		return notAllowed(req, res);
	}

	var token = req.query.token;
	var payerid = req.query.PayerID;
	var uid = req.user.uid;
	var period = req.session.paypalSubscriptionPeriod;

	if (!token || !payerid || !uid || !period) {
		res.redirect('/?subscribe=fail');
	}

	meta.settings.get('stripe-subscriptions', function(err, settings) {
		var amount = period === 'Month' ? settings.monthly : settings.annually;
		var desc = period === 'Month' ? 'Monthly subscription' : 'Annual subscription';

		API.createSubscription(token, payerid, {
			AMT:              amount,
			DESC:             desc,
			BILLINGPERIOD:    period,
			BILLINGFREQUENCY: 1,
		}, function(err, data) {
			if (err) {
				winston.warn(err);
				return res.redirect('/?subscribe=fail');
			}

			db.sortedSetAdd('stripe-subscriptions:subscribed', Date.now(), uid);
			user.setUserField(uid, 'stripe-subscriptions:pid', data.PROFILEID);
			if (settings['premium-group']) {
				groups.join(settings['premium-group'], uid);
			}

			winston.info('[stripe Succcessfully created a subscription for uid ' + uid + ' for ' + amount + ' per ' + period + '. PROFILEID: ' + data.PROFILEID);
			res.redirect('/?subscribe=success');
		});
	});
};

stripe.cancelSubscription = function(req, res, next) {
	if (!req.user) {
		return notAllowed(req, res);
	}

	var uid = req.user.uid;

	user.getUserField(uid, 'stripe-subscriptions:pid', function(err, pid) {
		if (err || !pid) {
			winston.info('[stripe] Attempted to cancel subscription for uid ' + uid + ' but user does not have a PID');
			return res.redirect('/?subscribe=cancel-fail');
		}

		meta.settings.get('stripe-subscriptions', function(err, settings) {
			API.modifySubscription(pid, "Cancel", function(error, data) {
				if (error || data["ACK"] === "Failure") {
					winston.info('[paypal] Attempted to cancel subscription for uid ' + uid + ' but paypal returned ' + data);
				}

				db.deleteObjectField('user:' + uid, 'stripe-subscriptions:pid');
				db.sortedSetRemove('stripe-subscriptions:subscribed', uid);
				if (settings['premium-group']) {
					groups.leave(settings['premium-group'], uid);
				}

				res.redirect('/?subscribe=cancel-success');
			});
		});
	});
};

module.exports = stripe;
