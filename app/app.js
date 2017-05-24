/*
   Copyright 2016 Daniel Kottow

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
*/

var util = require('util');
var url = require('url');
var path = require('path');

var _ = require('underscore');

var express = require('express');

/** globals **/
global.config = global.config || {};
global.config.sql_engine = global.config.sql_engine || 'sqlite'; //supported are: sqlite, mssql


var accountConfig;
if (global.config.sql_engine == 'sqlite') {
	accountConfig = global.config.data_dir;

} else if (global.config.sql_engine == 'mssql') {
	accountConfig = global.config.mssql_connection;
}

/*** end globals ***/

var AccountManager = require('./AccountManagerFactory.js').AccountManagerFactory;

var ApiController = require('./ApiController.js').ApiController;
var SignupController = require('./SignupController.js').SignupController;

var app = express();
var log = require('./log.js').log;

var accounts;
var controller;

app.init = function(options, cbAfter) {
	log.info('app.init()...');

	accounts = AccountManager.create(accountConfig);

	accounts.init(function(err) {
		if (err) {
			cbAfter(err);
			return;
		}
		initRoutes(options);
		log.info('...app.init()');
		cbAfter();
	});
}

function initRoutes(options) {

	//enable CORS
	app.use(function(req, res, next) {
	  res.header("Access-Control-Allow-Origin", "*");
	  res.header('Access-Control-Allow-Methods', 'GET, PUT, POST, DELETE, PATCH, OPTIONS'); 
	  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization, Access-Control-Request-Method, Access-Control-Request-Headers");
	  if (req.method == 'OPTIONS') res.status(200).send();
	  else next();
	});

	//signup
	var signupController = new SignupController();
	app.use('/public', signupController.router);
	app.use('/public', express.static('./public', { fallthrough: false }));

	//all api routes
	controller = new ApiController(accounts, options);
	app.use('/', controller.router);

	//uncaught exception handling 
	app.use(function(err, req, res, next) {

		log.error({req: req, err: err.message}, 'app.use...');
		log.debug({err: err}, 'app.use');

		if (res.headersSent) {
		    return next(err);
		}

		if (err.name === 'UnauthorizedError') {
		    res.status(401).send({error: err.message});
		} else {
			res.status(500).send({error: err.message});
		}

		log.debug('...app.use');
	});

}

exports.app = app; //you call app.init / app.listen to start server
