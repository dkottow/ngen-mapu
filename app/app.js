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

var express = require('express');
var bodyParser = require('body-parser');
var _ = require('underscore');

var fs = require('fs');
var path = require('path');
var util = require('util');
var url = require('url');

var Account = require('./Account.js').Account;
var Controller = require('./Controller.js').Controller;

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

var app = express();
var log = global.log.child({'mod': 'g6.app.js'});

var accounts = {};
var controller;

app.init = function(cbAfter) {
	log.info('app.init()...');


	//make sure tmp dir exists
	try { fs.mkdirSync(global.tmp_dir); } 
	catch(err) { 
		//ignore EEXIST
		if (err.code != 'EEXIST') {
			log.error({err: err, tmp_dir: global.tmp_dir}, 
				'app.init() failed. mkdirSync()');
			cbAfter(err);
			return;
		}
	} 

	//scan dir tree for accounts and databases
	initAccounts(global.data_dir, function() {
		initRoutes();
		log.info('...app.init()');
		cbAfter();
	});
}

function initRoutes() {

	//enable CORS
	app.use(function(req, res, next) {
	  res.header("Access-Control-Allow-Origin", "*");
	  res.header('Access-Control-Allow-Methods', 'GET, PUT, POST, DELETE, PATCH'); 
	  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
	  next();
	});

	//json parsing 
	app.use(bodyParser.json());

	//all app routes
	controller = new Controller(accounts);
	app.use('/', controller.router);

	//uncaught exception handling 
	app.use(function(err, req, res, next) {
		log.error({req: req, err: err}, 'Internal server error...');
		log.info({"req.body": req.body}, 'Error payload');
		if (res.headersSent) {
		    return next(err);
		}

		res.status(500).send({error: err.message});
		log.info({res: res}, '...Internal server error');
	});

}

function initAccounts(rootDir, cbAfter) {
	fs.readdir(rootDir, function (err, files) {
    	if (err) {
			log.error({err: err, rootDir: rootDir}, 
				'app.initAccounts() failed. readdir()');
        	cbAfter(err);
			return;
    	}

	    var accountDirs = files.map(function (file) {
    	    return path.join(rootDir, file);
	    }).filter(function (file) {
    	    return fs.statSync(file).isDirectory();
	    });

		var doAfter = _.after(accountDirs.length, function() {
			log.debug("...app.initAccounts()");
			cbAfter();
			return;
		});
		
		accountDirs.forEach(function (dir, i, subDirs) {
			log.debug(dir + " from " + subDirs);

			var account = new Account(dir);
			accounts[account.name] = account;	
			account.init(function(err) {
				doAfter();
			});
		});
	});
}


exports.app = app; //you call app.init / app.listen to start server
