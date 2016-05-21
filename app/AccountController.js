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

function AccountController(router, baseUrl, baseDir) {
	this.url = baseUrl;
	this.account = new Account(baseDir);
	this.databaseControllers = {};
	log.info("new AccountController @ " + this.url);

	this.init = function(cbAfter) {
		var me = this;
		log.debug("AccountController.init()...");		

		me.account.init(function(err) {

			var doAfter = _.after(_.size(me.account.databases), function() {
				log.debug("...AccountController.init()");		
				cbAfter();
			});

			_.each(me.account.databases, function(db) {
				var dbUrl = me.url + "/" + db.name();
				log.info('Serving ' + db.name() + " @ " + dbUrl);

				var ctrl = new DatabaseController(router, dbUrl, db);
				me.databaseControllers[dbUrl] = ctrl;
				ctrl.init(function(err) {
					doAfter();
				});
			});
		});

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

		//serve add database
		var postSchemaHandler = function(req, res) {
			log.info({req: req}, 'DatabaseController.postSchemaHandler()...');

			var schema = req.body;
			var dbUrl = me.url + "/" + schema.name;

			me.account.writeSchema(schema, function(err, db) {
				if (err) {
					sendError(req, res, err);
					return;
				}
				var ctrl = new DatabaseController(router, dbUrl, db);
				me.databaseControllers[dbUrl] = ctrl;
				ctrl.init(function(err) {					
					db.getInfo(function(err, result) {
						res.send(result);
					});
					log.info({res: res}, '...AccountController.post().');
				});
			});
		}

		router.post(this.url, postSchemaHandler);	
		router.post(this.url + '.db', postSchemaHandler);	

		//serve delete database
		var deleteSchemaHandler = function(req, res) {
			log.info(req.method + " " + req.url);

			var ctrl = me.databaseControllers[req.url];
			if ( ! ctrl) {
				var err = new Error(req.url + " not found.");
				sendError(req, res, err);	
				return;
			}

			me.account.removeDatabase(ctrl.db.name(), function(err, sucess) {
				if (err) {
					sendError(req, res, err);
					return;
				}
				
				delete me.databaseControllers[req.url];
				res.send({});
			});
		}

		router.delete(this.url + "/:schema", deleteSchemaHandler);	
		router.delete(this.url + '"/:schema.db', deleteSchemaHandler);	

	}


}

exports.AccountController = AccountController;

