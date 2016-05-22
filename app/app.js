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
var AccountController = require('./AccountController.js').AccountController;

/** globals **/
var log = global.log.child({'mod': 'g6.app.js'});

//max number of rows queried by any SELECT
global.row_max_count = 1000;
global.sqlite_ext = '.sqlite';

global.tmp_dir = './tmp';
global.data_dir = './data';

if (process.env.OPENSHIFT_DATA_DIR) {
	global.data_dir = process.env.OPENSHIFT_DATA_DIR + global.data_dir;
	global.tmp_dir = process.env.OPENSHIFT_DATA_DIR + global.tmp_dir;
}


/*** end globals ***/

var app = express();
var log = global.log.child({'mod': 'g6.app.js'});

var accounts = {};
var accountControllers = {};

app.init = function(cbAfter) {
	log.info('app.init()...');

	var router = new express.Router();

	//enable CORS
	app.use(function(req, res, next) {
	  res.header("Access-Control-Allow-Origin", "*");
	  res.header('Access-Control-Allow-Methods', 'GET, PUT, POST, DELETE'); 
	  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
	  next();
	});

	app.use(bodyParser.json()); //json parsing 

	//make sure tmp dir exists
	try { fs.mkdirSync(global.tmp_dir); } 
	catch(err) { 
		if (err.code != 'EEXIST') {
			log.error({err: err, tmp_dir: global.tmp_dir}, 
				'app.init() failed. mkdirSync()');
			cbAfter(err);
			return;
		}
	} //ignore EEXIST

	initAccounts(global.data_dir, function() {
		initControllers(router);
		initListAccountHandler(router);
		log.info('...app.init()');
		cbAfter();
	});

	app.use('/', router);

	app.use(function(err, req, res, next) {
		log.error({req: req, err: err}, 'Internal server error...');
		if (res.headersSent) {
		    return next(err);
		}
		res.send(500, {error: 'Internal server error'});
		log.info({res: res}, '...Internal server error');
	});

}

/*

not used for long time - useful after changing database files

app.get('/admin/reset', function(req, res) {
	//replace our express router by a new one calling serveAccounts
	for(var i = 0;i < app._router.stack.length; ++i) {
		var route = app._router.stack[i];
		if (route.handle.name == 'router') {
			app._router.stack.splice(i, 1);
			serveAccounts(data_dir);
			break;
		}
	}
	res.send('done.');
});
*/


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

function initControllers(router) {
	_.each(accounts, function(account) {
		var ctrl = new AccountController(router, account);		
		accountControllers[ctrl.url] = ctrl;
	});
}

function initListAccountHandler(router) {
	router.get('/', function(req, res) {
		log.info(req.method + ' ' + req.url);
		var accounts = _.map(accountControllers, function(ac) {
			return { name: ac.account.name,
					 url: ac.url
			};
		});

		res.send({ accounts : accounts });
	});
}


exports.app = app; //you call app.init / app.listen to start server
