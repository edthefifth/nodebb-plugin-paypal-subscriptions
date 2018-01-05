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
var default_plan_id = "insiders-monthly-subscription";
var default_plan_name = "Insiders Monthly Subscription";

stripe.configure = function() {
    meta.settings.get('stripe-subscriptions', function(err, settings) {
        if (!settings.api_key) {
                return winston.warn('[stripe-subscriptions] API Credentials not configured');
        }

        API = require('stripe')(settings.api_key);
        API.setApiVersion('2017-12-14');
        var plan_id = settings.plan_id ? settings_plan_id: default_plan_id;
        var plan_name = settings.plan_name ? settings.plan_name:default_plan_name;
        API.plans.retrieve(
            plan_id,
            function(err, plan) {
              if(err){
                  stripe.definePlan(plan_id,plan_name,settings.monthly,function(err,_plan){
                      if(err) return winston.warn('[stripe-subscriptions] error configuring plan:'+err);
                  });
              } 
                  
            }
        );
    });
};


stripe.definePlan = function(plan_id,plan_name,plan_amount,callback){
    var normalized_amount = plan_amount*100;
    API.plans.create({
      amount: normalized_amount,
      interval: "month",
      name: plan_name,
      currency: "usd",
      id: plan_id
    }, function(err, plan) {
      if(err){ return callback(err,null);}
      else {
          return callback(null,plan);
      }
    });
};


stripe.isSubscribed = function(uid, callback) {
	
  db.isSortedSetMember('stripe-subscriptions:subscribed', uid, callback);
};

stripe.subscribe = function(req, res, next) {
	if (!req.user) {
		return notAllowed(req, res);
	}
        
        var uid = req.user.uid;

	stripe.isSubscribed(uid, function(err, isSubscribed) {
		if (isSubscribed) {
			res.redirect('/?subscribe=already-subscribed');
			return;
		}
                
                user.getUserFields(uid, ['email'], function(err, userData) {
                    if (err) {
                            winston.info('[stripe] Could not find email for user:'+uid);
                            res.redirect('/?subscribe=fail');
                            return;
                    }

                    meta.settings.get('stripe-subscriptions', function(err, settings) {
                            res.render('subscribe', {
                                    company_name: settings.company_name,
                                    amount: (settings.monthly*100),
                                    monthly: settings.monthly,
                                    publish_key: settings.publish_key,
                                    notsetup: (!(settings.monthly) || !(settings.api_key) || !(settings.publish_key)),
                                    title: "Members Only Section",
                                    email: userData.email
                            });
                    });
                });    
	});
};

stripe.onSubscribe = function(req, res, next) {
	if (!req.user) {
		return notAllowed(req, res);
	}

	var token = req.body.token;
        var email = req.body.email;

  
        if(!email)
        {
          winston.warn('[stripe] Invalid Email')
          return res.redirect('/?subscribe=fail');
        }

        API.tokens.retrieve(
            token.id,
            function(err, token) {
                
                if(err)
                {
                    winston.warn('[stripe] '+err)
                    return res.redirect('/?subscribe=fail');
                }    
                
                meta.settings.get('stripe-subscriptions', function(err, settings) {
                    var url = nconf.get('url');
                    var plan_id = settings.plan_id ? settings_plan_id: default_plan_id;
                    if(settings.sales_tax_rate)
                    {    
                        if(!token.card)
                        {    
                            winston.warn('[stripe] Card not set in token')
                            return res.redirect('/?subscribe=fail');
                        }
                        var tax_rate = settings.sales_tax_state && settings.sales_tax_state === token.card.address_state ? +(settings.sales_tax_rate):null;
                    }
                    else
                    {
                        var tax_rate = null;
                    }    
                    API.customers.create(
                    { 
                        email: email,
                        source:token
                    },
                    function(err, customer) {
                        if(err){
                            return winston.warn(err);
                            return res.redirect('/?subscribe=fail');
                        }
                        req.session.customer = customer.id;
                        var subscrip = {
                            customer: customer.id,
                            items: [
                              {
                                plan: plan_id
                              }
                            ]
                        };
                        if(tax_rate) subscrip.tax_percent = tax_rate;
                        API.subscriptions.create(subscrip, function(err, subscription) {
                              if(err){
                                  return winston.warn(err);
                                  return res.redirect('/?subscribe=fail');
                              }
                              else{
                                  req.session.subscription = subscription.id;
                                  //url = url.replace('cgi?bin', 'cgi-bin'); // why? no idea.
                                  res.redirect(url);
                              }

                            }
                        );

                    }
                  );

                });
            }
        );        
};

stripe.onSuccess = function(req, res, next) {
	if (!req.user) {
		return notAllowed(req, res);
	}

	var customer_id = req.session.customer;
        var subscription_id = req.session.subscription;
	var uid = req.user.uid;

	if (!customer_id ||  !uid ) {
		res.redirect('/?subscribe=fail');
	}

	meta.settings.get('stripe-subscriptions', function(err, settings) {
	

			db.sortedSetAdd('stripe-subscriptions:subscribed', Date.now(), uid);
			user.setUserField(uid, 'stripe-subscriptions:cid', customer_id);
                        user.setUserField(uid, 'stripe-subscriptions:sid', subscription_id);
			if (settings['premium-group']) {
				groups.join(settings['premium-group'], uid);
			}

			winston.info('[stripe Succcessfully created a subscription for uid ' + uid + ' for  customer: ' + customer_id);
			res.redirect('/?subscribe=success');
		
	});
};

stripe.cancelSubscription = function(req, res, next) {
	if (!req.user) {
		return notAllowed(req, res);
	}

	var uid = req.user.uid;

	user.getUserField(uid, 'stripe-subscriptions:sid', function(err, sid) {
		if (err || !sid) {
			winston.info('[stripe] Attempted to cancel subscription for uid ' + uid + ' but user does not have a SID');
			return res.redirect('/?subscribe=cancel-fail');
		}

		meta.settings.get('stripe-subscriptions', function(err, settings) {
			API.subscriptions.del(sid, function(err, conf) {
				if (err) {
					winston.info('[stripe] Attempted to cancel subscription for uid ' + uid + ' but stripe returned ' + err);
				}

				db.deleteObjectField('user:' + uid, 'stripe-subscriptions:sid');
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
