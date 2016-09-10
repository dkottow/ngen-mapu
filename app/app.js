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

var fs = require('fs');
var path = require('path');
var util = require('util');
var url = require('url');

var _ = require('underscore');

var express = require('express');

/** globals **/
var log = global.log.child({'mod': 'g6.app.js'});

//max number of rows queried by any SELECT
global.row_max_count = 1000;
global.sqlite_ext = '.sqlite';

global.tmp_dir = path.join(process.cwd(), 'tmp');
global.data_dir = path.join(process.cwd(), 'data');

if (process.env.OPENSHIFT_DATA_DIR) {
	global.tmp_dir = path.join(process.env.OPENSHIFT_DATA_DIR, 'tmp');
	global.data_dir = path.join(process.env.OPENSHIFT_DATA_DIR, 'data');
}

/*** end globals ***/

var AccountManager = require('./AccountManager.js').AccountManager;
var ApiController = require('./ApiController.js').ApiController;
var SignupController = require('./SignupController.js').SignupController;

var app = express();
var log = global.log.child({'mod': 'g6.app.js'});

var accounts;
var controller;

app.init = function(options, cbAfter) {
	log.info('app.init()...');

	accounts = new AccountManager();

	accounts.init(function() {
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
	  next();
	});

	//signup
	var signupController = new SignupController();
	app.use('/public', signupController.router);
	app.use('/public', express.static('./public'));

	//all api routes
	controller = new ApiController(accounts, options);
	app.use('/', controller.router);

	//uncaught exception handling 
	app.use(function(err, req, res, next) {

		log.error({req: req, err: err}, 'app.use...');
		log.info({"req.body": req.body}, 'Error payload');

		if (res.headersSent) {
		    return next(err);
		}

		if (err.name === 'UnauthorizedError') {
		    res.status(401).send({error: err.message});
		} else {
			res.status(500).send({error: err.message});
		}

		log.info({res: res}, '...app.use');
	});

}

exports.app = app; //you call app.init / app.listen to start server
