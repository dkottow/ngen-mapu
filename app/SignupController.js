var request = require('request');
var validator = require('validator');
var express = require('express');
var bodyParser = require("body-parser");
var jwt = require('jsonwebtoken');

var envPath = './.env'; 
if (process.env.OPENSHIFT_DATA_DIR) { 
    envPath = process.env.OPENSHIFT_DATA_DIR + '/.env'; 
} 
 
require('dotenv').config({path: envPath}); 

var AUTH0_SCOPE = 'openid email app_metadata';

function Controller() {
	this.router = new express.Router();
	this.initRoutes();
}

function sendError(req, res, err, code) {
	log.error({req: req, code: code, err: err}, 'Controller.sendError()');
	res.status(code).send({error: err.message, arg: err.arg});
}

Controller.prototype.initRoutes = function() {
	var me = this;

	var urlencodedParser = bodyParser.urlencoded({ extended: true });

	this.router.post('/signup', urlencodedParser, function(req, res) {
		log.info({req: req}, 'Controller.signup()...');

		if ( ! req.body) {
			sendError(req, res, new Error('No form data'), 400);
			return;
		}

		me.validateSignup(req.body.email, req.body.account, 
            function(err, rsp) {

			if (err) {
				sendError(req, res, err, 400);
				return;
			}
			
			me.doSignup(req.body.email, req.body.account, req.body.password,
            	function(err, rsp) {

				if (err) {
					sendError(req, res, err, 400);
					return;
				}
				
				var body = {
					email: req.body.email, 
					account: req.body.account
				};

				res.send(body);
				log.info({body: body}, 'Controller.signup()');
				log.info({res: res}, '...Controller.signup()');
			});
			
		});
	});

	this.router.post('/login', urlencodedParser, function(req, res) {
		log.info({req: req}, 'Controller.login()...');

		if ( ! req.body) {
			sendError(req, res, new Error('No form data'), 400);
			return;
		}

		var email = req.body.email || req.body.username;

		me.doLogin(email, req.body.password, function(err, rsp) {
			if (err) {
				sendError(req, res, err, 400);
				return;
			}

			var token_info = jwt.decode(rsp.id_token);
			var body = { 
				id_token: rsp.id_token 
				, account: token_info.app_metadata.account 
			};

			res.send(body);
			log.debug({body: body}, 'Controller.login()');
			log.info({res: res}, '...Controller.login()');
		});
	});


}

Controller.prototype.doLogin = function(email, pass, cbAfter) {
	log.debug({email: email, pass: pass}, 'Controller.doLogin()...');

	var authRequest = {
		url: 'https://' + process.env.AUTH0_DOMAIN + '/oauth/ro'
		, json: true,
		body: {
			client_id: process.env.AUTH0_CLIENT_ID // Donkeylift 
			, username: email
			, password: pass
			, connection: process.env.AUTH0_CONNECTION
			, scope: AUTH0_SCOPE
		}
	} 

	log.debug({reqParam: authRequest}, 'Controller.doLogin(). Auth0 request');
	//do login
	request.post(authRequest, function(err, rsp, body) {
		log.debug({rsp: rsp}, 'Controller.doLogin(). Auth0 response');
		if (err) {
			cbAfter(err, null);
			return;
		}

		if (rsp.statusCode != 200) {
			var err = new Error('User login failed.');
			cbAfter(err, null);
			return;
		}

		log.debug({"rsp.body": rsp.body}, '...Controller.doLogin()');
		cbAfter(null, rsp.body);
	});

}

Controller.prototype.doSignup = function(email, account, pass, cbAfter) {
	log.debug({email: email, account: account, pass: pass}, 'Controller.doSignup()...');
	var me = this;
	var authRequest = {
		url: 'https://' + process.env.AUTH0_DOMAIN + '/api/v2/users'
		, auth: { 
			bearer: process.env.AUTH0_API_TOKEN 
		}
		, json: true
		, body: { 
			connection: process.env.AUTH0_CONNECTION
			, email: email
			/*, username: email */
			, password: pass
			, app_metadata: { admin: true, account: account }
		}
	};

	log.debug({reqParam: authRequest}, 'Controller.doSignup(). Auth0 request');

	//create user
	request.post(authRequest, function(err, rsp, body) {
		log.debug({rsp: rsp}, 'Controller.doSignup(). Auth0 response');
		if (err) {
			cbAfter(err, null);
			return;
		}

		if (rsp.statusCode != 201) {
			var err = new Error('User signup failed.');
			cbAfter(err, null);
			return;
		}

		me.getApiToken(function(err, apiToken) {
			if (err) {
				cbAfter(err, null);
				return;
			}

			//create account
			var apiRequest = {
				url: process.env.DONKEYLIFT_API + '/' + account
				, auth: { 
					bearer: apiToken
				}
			};
			log.debug({reqParam: apiRequest}, 'Controller.doSignup(). PutAccount request');

			request.put(apiRequest, function(err, rsp, body) {
				log.debug({rsp: rsp}, 'Controller.doSignup(). PutAccount response');
				if (err) {
					cbAfter(err, null);
					return;
				}

				if (rsp.statusCode == 200) {
					cbAfter(null, true);
					return;
				} 

				var err = new Error('Create Account failed.');
				cbAfter(err, null);
			});
		});
	});
}

Controller.prototype.validateSignup = function(email, account, cbAfter) {
	log.debug({email: email, account: account}, 'Controller.validateSignup()...');
	var me = this;

	if ( ! validator.isEmail(email)) {
		var err = new Error('Username is not a valid email address.');
		err.arg = 'email';	
		cbAfter(err, null);
		return;
	}

	if ( ! /^\w+$/.test(account)) {
		var err = new Error('Account name has invalid caracters.'
                          + ' Only [A-Za-z0-9_] are allowed.');
		err.arg = 'account';	
		cbAfter(err, null);
		return;
	}

	var authRequest = {
		url: 'https://' + process.env.AUTH0_DOMAIN + '/api/v2/users'
		, auth: { 
			bearer: process.env.AUTH0_API_TOKEN 
		}
		, qs: {
			q: 'name: "' + email + '"'
			, search_engine: 'v2'
		}
	};

	log.debug({reqParam: authRequest}, 'Controller.validateSignup(). Auth0 request.');

	//check if user exists
	request.get(authRequest, function(err, rsp, body) {
		log.debug({rsp: rsp}, 'Controller.validateSignup(). Auth0 response.');
		if (err) {
			cbAfter(err, null);
			return;
		}

		if (rsp.statusCode != 200) {
			var err = new Error('User validation failed.');
			cbAfter(err, null);
			return;
		}

		var users = JSON.parse(body);
		if (users.length > 0) {
			var err = new Error('User already exists.');
			err.arg = 'email';	
			cbAfter(err, null);
			return;
		}

		me.getApiToken(function(err, apiToken) {
			if (err) {
				cbAfter(err, null);
				return;
			}

			//check if account exists
			var apiRequest = {
				url: process.env.DONKEYLIFT_API + '/' + account
				, auth: { 
					bearer: apiToken
				}
			};

			log.debug({reqParam: apiRequest}, 'Controller.validateSignup(). GetAccount request');

			request.get(apiRequest, function(err, rsp, body) {
				log.debug({rsp: rsp}, 'Controller.validateSignup(). GetAccount response');
				if (err) {
					cbAfter(err, null);
					return;
				}

				if (rsp.statusCode == 200) {
					var err = new Error('Account already exists.');
					err.arg = 'account';	
					cbAfter(err, null);
					return;
				} 

				if (rsp.statusCode == 404) {
					//if account does not exist, signup validation is passed
					cbAfter(null, true);
					return;
				} 

				var err = new Error('Account validation failed');
				cbAfter(err, null);
			});
		});
	});
}

Controller.prototype.getApiToken = function(cbAfter) {
	var me = this;	

	var refresh = true;
	if (this.jwtIdToken) {
		var token_info = jwt.decode(this.jwtIdToken);
		if (token_info.exp > (Date.now() / 1000)) refresh = false;
	}

	if ( ! refresh) {
		cbAfter(null, this.jwtIdToken);
		return;
	}

	var authRequest = {
		url: 'https://' + process.env.AUTH0_DOMAIN + '/delegation'
		, json: true
		, body: { 
			grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer'
			, client_id: process.env.AUTH0_CLIENT_ID
			, refresh_token: process.env.AUTH0_REFRESH_TOKEN
			, scope: AUTH0_SCOPE
		}
	}

	request.post(authRequest, function(err, rsp, body) {
		if (err) {
			cbAfter(err, null);
			return;
		}
		
		if (rsp.statusCode != 200) {
			var err = new Error(rsp.statusMessage);
			cbAfter(err, null);
			return;
		}

		me.jwtIdToken = body.id_token;
		cbAfter(null, me.jwtIdToken);
	});
}

exports.SignupController = Controller;
