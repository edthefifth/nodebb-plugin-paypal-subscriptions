<form role="form" class="stripe-subscriptions-settings">
	<div class="row">
		<div class="col-sm-2 col-xs-12 settings-header">Stripe API Connection</div>
		<div class="col-sm-10 col-xs-12">
			<p class="lead">
				Visit <a href="https://stripe.com">Stripe</a> to set up a new account.
			</p>
			<div class="form-group">
                                <label for="api_key">API Key</label>
				<input type="password" id="api_key" name="api_key" title="API Key" class="form-control" placeholder="sk_XXXXXXX">
                                <label for="api_key">Publishable Key</label>
				<input type="text" id="publish_key" name="publish_key" title="Publishable Key" class="form-control" placeholder="pk_XXXXXXX">
			</div>
		</div>
	</div>

	<div class="row">
		<div class="col-sm-2 col-xs-12 settings-header">Subscription Data</div>
		<div class="col-sm-10 col-xs-12">
                        <div class="form-group">
				<label for="name">Membership Name</label>
				<input type="text" id="name" name="name" title="Membership Name" class="form-control" placeholder="Insider">
			</div>
			<div class="form-group">
				<label for="monthly">Monthly Cost($)</label>
				<input type="text" id="monthly" name="monthly" title="Monthly Cost" class="form-control" placeholder="9.99">
			</div>
                    
                        <div class="form-group">
				<label for="company_name">Company Name</label>
				<input type="text" id="company_name" name="company_name" title="Company Name" class="form-control" placeholder="Company Name">
			</div>
                        <div class="form-group">
				<label for="sales_tax_rate">Sales Tax Rate (optional %)</label>
				<input type="text" id="sales_tax_rate" name="sales_tax_rate" title="Sales Tax Rate" class="form-control" placeholder="8.25">
			</div>
                        <div class="form-group">
				<label for="sales_tax_stateate">Sales Tax State (Abbr)</label>
				<input type="text" id="sales_tax_state" name="sales_tax_state" title="Sales Tax State" class="form-control" placeholder="TX">
			</div>
		</div>
	</div>

	<div class="row">
		<div class="col-sm-2 col-xs-12 settings-header">Premium Group</div>
		<div class="col-sm-10 col-xs-12">
			<label for="premium-group">Add premium members to this group:</label><br />
			<select name="premium-group" id="premium-group" class="form-control">
				<!-- BEGIN groups -->
				<option value="{groups.value}">{groups.name}</option>
				<!-- END groups -->
			</select><br /><br />
		</div>
	</div>
</form>
<button id="save" class="floating-button mdl-button mdl-js-button mdl-button--fab mdl-js-ripple-effect mdl-button--colored">
	<i class="material-icons">save</i>
</button>