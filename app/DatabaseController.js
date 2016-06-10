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
var url = require('url');
var path = require('path');

var log = global.log.child({'mod': 'g6.DatabaseController.js'});
var parser = require('./QueryParser.js');

function sendError(req, res, err) {
	log.error({err: err, req: req}, "DatabaseController.sendError()");
	var msg = err.message;
	//if (err.code) msg += ' (' + err.code + ')'; 
	res.status(400).send(msg);
}

function DatabaseController(router, baseUrl, db)
{	
	this.url = baseUrl;
	this.db = db;
	//this.seed = Math.random();
	//console.log("created DatabaseController " + this.seed);
	log.info("new DatabaseController @ " + baseUrl);

	this.initRoutes(router);
}

DatabaseController.prototype.updateRoutes = function(router) {
	var me = this;
	_.each(me.db.tables(), function(table) {
		me.addTableRoutes(router, table);
	});
}

DatabaseController.prototype.initRoutes = function(router) {
	var me = this;

	//get metadata 
	var getInfoHandler = function(req, res) {
		log.info({req: req}, 'DatabaseController.getInfoHandler()...');
		me.db.getInfo(function(err, result) {
			if (err) {
				sendError(req, res, err);
				return;
			}
			result.url = me.url;
			_.each(result.tables, function(t) {
				t.url = me.url + "/" + t.name;
			});
			log.trace(result);
			res.send(result); 
			log.info({res: res}, '...DatabaseController.getInfoHandler().');
		});
		//log.info(" served by " + me.seed);
		//res.send(defs);
	}

	router.get(me.url, getInfoHandler);
	router.get(me.url + ".info", getInfoHandler);
	
	//get sqlite file 
	var getFileHandler = function(req, res) {
		log.info({req: req}, 'DatabaseController.getFileHandler()...');
		var fn = me.db.dbFile;
		res.sendFile(fn, function(err) {
			if (err) {
				sendError(req, res, err);
				return;
			}
			log.info({res: res}, '...DatabaseController.getFileHandler().');
		});
	}
	router.get(me.url + ".sqlite", getFileHandler);

	_.each(me.db.tables(), function(table) {
		me.addTableRoutes(router, table);
	});

	//patch schema 
	var patchSchemaHandler = function(req, res) {
		log.info({req: req}, 'DatabaseController.patchSchema()...');
		log.debug({'req.body': req.body});

		var patches = req.body;
		me.db.patchSchema(patches, function(err, result) {
			if (err) {
				sendError(req, res, err);
				return;
			}
			log.debug({'res.body': result});
			res.send(result); 
			log.info({res: res}, '...DatabaseController.patchSchema().');
		});
		//log.info(" served by " + me.seed);
		//res.send(defs);
	}
	router.patch(me.url, patchSchemaHandler);
	router.patch(me.url + ".db", patchSchemaHandler);

}

DatabaseController.prototype.addTableRoutes = function(router, table) {
	var me = this;
	var rowsExt = ".rows";
	var tableUrl = me.url + "/" + table.name;

	var getRowsHandler = function(req, res) {
		log.info({req: req}, 'DatabaseController.get()...');
		
		var params = {};
		_.each(req.query, function(v, k) {
			if (k[0] == '$') {
				var param = parser.parse(k + "=" + v);	
				params[param.name] = param.value;
			} else {
				params[k] = v;
			}
		});
		log.debug({params: params});

		me.db.all(table.name, {
				filter: params['$filter'] 
				, fields: params['$select'] 
				, order: params['$orderby'] 
				, limit: params['$top'] 
				, offset: params['$skip'] 
				, distinct: params['$distinct'] 
				, debug: params['debug']	
			},
			function(err, result) { 
				if (err) {
					sendError(req, res, err);
					return;
				}

				//add nextUrl if nextOffset
				if (result.nextOffset) {
					var urlObj = url.parse(req.url, true);
					urlObj.search = undefined;
					urlObj.query['$skip'] = result.nextOffset;
					result.nextUrl = url.format(urlObj)
					delete result.nextOffset;
				}

				log.trace(result);
				res.send(result); 
				log.info({res: res}, '...DatabaseController.get().');
			}
		);

	}		

	router.get(tableUrl, getRowsHandler);	
	router.get(tableUrl + rowsExt, getRowsHandler);	

	var statsExt = ".stats";
	router.get(tableUrl + statsExt, function(req, res) {

		log.info({req: req}, 'DatabaseController.getStats()...');
		var params = {};
		_.each(req.query, function(v, k) {
			if (k[0] == '$') {
				var param = parser.parse(k + "=" + v);	
				params[param.name] = param.value;
			} else {
				params[k] = v;
			}
		});

		me.db.getStats(table.name, { 
				filter: params['$filter'], 
				fields: params['$select'] 
			}, 
			function(err, result) {
				if (err) {
					sendError(req, res, err);
					return;
				}
				log.debug(result);
				res.send(result); 
				log.info({res: res}, '...DatabaseController.getStats().');
			}
		);

	});	

	//insert rows into table
	var postRowHandler = function(req, res) {
		log.info({req: req}, 'DatabaseController.post()...');
		log.debug({'req.body': req.body});

		var rows = req.body;
		var opts = req.query;
		me.db.insert(table.name, rows, opts, function(err, result) {
			if (err) {
				sendError(req, res, err);
				return;
			}
			log.debug({'res.body': result});
			res.send(result); 
			log.info({res: res}, '...DatabaseController.post().');
		});
	}
	router.post(tableUrl, postRowHandler);
	router.post(tableUrl + rowsExt, postRowHandler);

	//update rows in table
	var putRowHandler = function(req, res) {
		log.info({req: req}, 'DatabaseController.put()...');
		log.debug({'req.body': req.body});

		var rows = req.body;
		var opts = req.query;
		me.db.update(table.name, rows, opts, function(err, result) {
			if (err) {
				sendError(req, res, err);
				return;
			}
			log.debug({'res.body': result});
			res.send(result);  
			log.info({res: res}, '...DatabaseController.put().');
		});
	}
	router.put(tableUrl, putRowHandler);
	router.put(tableUrl + rowsExt, putRowHandler);

	//delete rows from table
	var deleteRowHandler = function(req, res) {
		log.info({req: req}, 'DatabaseController.delete()...');
		log.debug({'req.body': req.body});

		var rowIds = req.body;
		me.db.delete(table.name, rowIds, function(err, result) {
			if (err) {
				sendError(req, res, err);
				return;
			}
			res.send(result); 
			log.info({res: res}, '...DatabaseController.delete().');
		});
	}
	router.delete(tableUrl, deleteRowHandler);
	router.delete(tableUrl + rowsExt, deleteRowHandler);
}


exports.DatabaseController = DatabaseController;

