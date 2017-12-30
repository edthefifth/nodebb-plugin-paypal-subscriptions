'use strict';
/* globals $, app, socket */

define('admin/plugins/stripe-subscriptions', ['settings'], function(Settings) {

	var ACP = {};

	ACP.init = function() {
		Settings.load('stripe-subscriptions', $('.stripe-subscriptions-settings'));

		$('#save').on('click', function() {
			Settings.save('stripe-subscriptions', $('.stripe-subscriptions-settings'), function() {
				app.alert({
					type: 'success',
					alert_id: 'stripe-subscriptions-saved',
					title: 'Settings Saved',
					message: 'Please reload your NodeBB to apply these settings',
					clickfn: function() {
						socket.emit('admin.reload');
					}
				});
			});
		});
	};

	return ACP;
});