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

var _ = require('underscore');

var fs = require('fs');
var path = require('path');
var util = require('util');

var Account = require('./Account.js').Account;
var DatabaseController = require('./DatabaseController.js')
								.DatabaseController;

var log = global.log.child({'mod': 'g6.AccountController.js'});

function sendError(req, res, err) {
	log.error(err);
	log.warn(req.method + " " + req.url + " failed.");
	res.send(400, err.message);
}

function AccountController(router, account) {
	this.account = account; 
	this.databaseControllers = {};
	this.url = "/" + account.name;

	log.info("new AccountController @ " + this.url);

	this.initRoutes(router);
	this.initDBControllers(router);
}

AccountController.prototype.initDBControllers = function(router) {
	log.debug("AccountController.initDBControllers()...");		
	_.each(this.account.databases, function(db) {
		var dbUrl = this.url + "/" + db.name();
		log.info('Serving ' + db.name() + " @ " + dbUrl);

		var ctrl = new DatabaseController(router, dbUrl, db);
		this.databaseControllers[dbUrl] = ctrl;
	}, this);
	log.debug("...AccountController.initDBControllers()");
}

AccountController.prototype.initRoutes = function(router) {
	log.debug("AccountController.initRoutes()...");		
	var me = this;

	//serve list databases
	var getSchemaListHandler = function(req, res) {
		log.info({req: req}, 'AccountController.get()...');

		me.account.getInfo(function(err, result) {
			if (err) {
				sendError(req, res, err);
				return;
			}
			
			result.url = me.url; 
			_.each(me.databaseControllers, function(ctrl) {
				result.databases[ctrl.db.name()].url = ctrl.url;
			});

			log.trace(result);
			res.send(result); 
			log.info({res: res}, '...AccountController.get().');
			
		});
	}
		
	router.get(this.url, getSchemaListHandler);	
	router.get(this.url + '.prj', getSchemaListHandler);	

	//serve write database (adds or replaces if empty)
	var putSchemaHandler = function(req, res) {
		log.info({req: req}, 'DatabaseController.putSchemaHandler()...');

		var schema = req.body;
		schema.name = req.params.schema;

		me.account.createDatabase(schema, function(err, db) {
			if (err) {
				sendError(req, res, err);
				return;
			}
			
			var ctrl = me.databaseControllers[req.path];
			if (ctrl) {
				log.debug('Updating ' + db.name() + " @ " + req.path);
				ctrl.db = db;
				ctrl.updateRoutes(router);
			} else {
				log.debug('Adding ' + db.name() + " @ " + req.path);
				ctrl = new DatabaseController(router, req.path, db);
				me.databaseControllers[req.path] = ctrl;
			}
			db.getInfo(function(err, result) {
				res.send(result);
			});
			log.info({res: res}, '...AccountController.putSchemaHandler().');
		});
	}

	router.put(this.url + "/:schema", putSchemaHandler);	
	router.put(this.url + "/:schema.db", putSchemaHandler);	

	//serve delete database
	var deleteSchemaHandler = function(req, res) {
		log.info(req.method + " " + req.url);

		var ctrl = me.databaseControllers[req.path];
		if ( ! ctrl) {
			var err = new Error(req.url + " not found.");
			sendError(req, res, err);	
			return;
		}

		var opts = req.query;
		me.account.delDatabase(ctrl.db.name(), opts, function(err, sucess) {
			if (err) {
				sendError(req, res, err);
				return;
			}

			delete me.databaseControllers[req.path];

			//TODO after delete, we should recreate all routes - see
			//https://github.com/expressjs/express/issues/2596

			res.send({});
		});
	}

	router.delete(this.url + "/:schema", deleteSchemaHandler);	
	router.delete(this.url + '"/:schema.db', deleteSchemaHandler);	

	log.debug("...AccountController.initRoutes()");		
}

exports.AccountController = AccountController;

