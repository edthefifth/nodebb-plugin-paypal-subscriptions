<!-- IF notsetup -->
<div class="alert alert-danger" role="alert">
	<span class="fa fa-exclamation-circle"></span>
	The subscription module has not been properly set-up. Please consult your administrator.
</div>
<!-- ELSE -->
<div class="alert alert-info" role="alert">
	<span class="fa fa-lock"></span>
	In order to gain full access to this forum, you'll need to sign up for a subscription plan.
</div>

<div class="row">
	<div class="col-sm-12 col-md-6">
		<div class="well">
			<form method="POST" id="stripePOSTForm">
				<input name="email" class="form-control" placeholder="your_name@example.com" required="true"> 
                                <input type="hidden" value="" name="token" id="stripeToken">
				<br /><br />

			</form>
                             
                              
                        <script src="https://checkout.stripe.com/checkout.js"></script>
                        
                        <h1>${monthly}/Month Plan</h1>
                        <h5>Sign up for unlimited access to all <b>Members Only</b> forums</h5>
                        <h5>Get early access to all new content we create</h5>
                        <h5>Includes an all-access pass to communicate with our staff of writers</h5>

                        <button id="customButton" class="btn btn-primary">Join</button>

                        <script>
                        var handler = StripeCheckout.configure({
                          key: '{publish_key}',
                          image: 'https://stripe.com/img/documentation/checkout/marketplace.png',
                          locale: 'auto',
                          token: function(token) {
                            // You can access the token ID with `token.id`.
                            // Get the token ID to your server-side code for use.
                            document.getElementById('stripeToken').value = token.id;
                            document.getElementById('stripePOSTForm').submit();
                          }
                        });

                        document.getElementById('customButton').addEventListener('click', function(e) {
                          // Open Checkout with further options:
                          handler.open({
                            name: '{company_name}',
                            description: 'Insider Subscription',
                            zipCode: true,
                            billingAddress: true,
                            amount: ({amount})
                          });
                          e.preventDefault();
                        });

                        // Close Checkout on page navigation:
                        window.addEventListener('popstate', function() {
                          handler.close();
                        });
                        </script>
		</div>
	</div>
</div>

<!-- ENDIF notsetup -->