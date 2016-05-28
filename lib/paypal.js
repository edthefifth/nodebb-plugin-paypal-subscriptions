'use strict';

var API;
var winston = require('winston');
var nconf = require('nconf');
var meta = require.main.require('./src/meta');
var user = require.main.require('./src/user');
var db = require.main.require('./src/database');
var notAllowed = require.main.require('./src/controllers/helpers').notAllowed;
var paypal = {};


paypal.configure = function() {
	meta.settings.get('paypal-subscriptions', function(err, settings) {
		if (!settings.username || !settings.password || !settings.signature) {
			return winston.warn('[paypal-subscriptions] API Credentials not configured');
		}

		var params = {
			username: settings.username,
			password: settings.password,
			signature: settings.signature
		};

		var api = require('paypal-recurring');

		if (settings['is-live'] === 'off') {
			API = new api(params);
		} else {
			API = new api(params, 'production');
		}
	});
};

paypal.isSubscribed = function(uid, callback) {
	db.isSortedSetMember('paypal-subscriptions:subscribed', uid, callback);
};

paypal.subscribe = function(req, res, next) {
	if (!req.user) {
		return notAllowed(req, res);
	}

	paypal.isSubscribed(req.user.uid, function(err, isSubscribed) {
		if (isSubscribed) {
			res.redirect('/?subscribe=already-subscribed');
			return;
		}

		meta.settings.get('paypal-subscriptions', function(err, settings) {
			res.render('subscribe', {
				monthly: settings.monthly,
				annually: settings.annually,
				notsetup: (!(settings.monthly && settings.monthly) || (!settings.username || !settings.password || !settings.signature)),
				title: "Subscribe"
			});
		});
	});
};

paypal.onSubscribe = function(req, res, next) {
	if (!req.user) {
		return notAllowed(req, res);
	}

	var period = req.body.period;

	if (period !== 'Month' && period !== 'Annual') {
		winston.warn('[paypal] Invalid Period')
		return res.redirect('/?subscribe=fail');
	}

	meta.settings.get('paypal-subscriptions', function(err, settings) {
		var url = nconf.get('url');

		var params = {
			"RETURNURL":                      url + '/paypal-subscriptions/success',
			"CANCELURL":                      url + '/?subscribe=fail',
			"L_BILLINGAGREEMENTDESCRIPTION0": period === 'Month' ? 'Monthly subscription' : 'Annual subscription',
			"PAYMENTREQUEST_0_AMT":           period === 'Month' ? settings.monthly : settings.annually
		};

		API.authenticate(params, function(err, data, url) {
			if (err || !url) {
				winston.warn(err);
				return res.redirect('/?subscribe=fail');
			}

			req.session.paypalSubscriptionPeriod = req.body.period;
			res.redirect(url);
		})
	});
};

paypal.onSuccess = function(req, res, next) {
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

	meta.settings.get('paypal-subscriptions', function(err, settings) {
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

			db.sortedSetAdd('paypal-subscriptions:subscribed', Date.now(), uid);
			user.setUserField(uid, 'paypal-subscriptions:pid', data.PROFILEID);

			winston.info('[paypal] Succcessfully created a subscription for uid ' + uid + ' for ' + amount + ' per ' + period + '. PROFILEID: ' + data.PROFILEID);
			res.redirect('/?subscribe=success');
		});
	});
};

paypal.cancelSubscription = function(req, res, next) {
	if (!req.user) {
		return notAllowed(req, res);
	}

	var uid = req.user.uid;

	user.getUserField(uid, 'paypal-subscriptions:pid', function(err, pid) {
		if (err || !pid) {
			winston.info('[paypal] Attempted to cancel subscription for uid ' + uid + ' but user does not have a PID');
			return res.redirect('/?subscribe=cancel-fail');
		}

		API.modifySubscription(pid, "Cancel", function(error, data) {
			if (error || data["ACK"] === "Failure") {
				winston.info('[paypal] Attempted to cancel subscription for uid ' + uid + ' but paypal returned ' + data);
			}

			db.deleteObjectField('user:' + uid, 'paypal-subscriptions:pid');
			db.sortedSetRemove('paypal-subscriptions:subscribed', uid);

			res.redirect('/?subscribe=cancel-success');
		});
	});
};

module.exports = paypal;