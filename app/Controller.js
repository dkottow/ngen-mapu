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

var express = require('express');

var parser = require('./QueryParser.js');

var log = global.log.child({'mod': 'g6.Router.js'});

function sendError(req, res, err, code) {
	log.error({req: req, code: code, err: err}, 'Controller.sendError()');
	res.status(code).send({error: err.message});
}

function Controller(accounts) {
	this.accounts = accounts;
	this.router = new express.Router();
	this.initRoutes();
}

Controller.prototype.initRoutes = function() {
	log.debug("Controller.initRoutes()...");		
	var me = this;

	this.router.get('/', function(req, res) {
		me.listAccounts(req, res);
	});

	this.router.get(/^\/(\w+)$/, function(req, res) {
		me.getAccount(req, res);
	});

	this.router.route(/^\/(\w+)\/(\w+)(?:\.db)?$/)
		.get(function(req, res) {
			me.getDatabase(req, res);
		})
		.put(function(req, res) {
			me.putDatabase(req, res);
		})
		.patch(function(req, res) {
			me.patchDatabase(req, res);
		})
		.delete(function(req, res) {
			me.delDatabase(req, res);
		});

	this.router.get(/^\/(\w+)\/(\w+)\.sqlite?$/, function(req, res) {
		me.getDatabaseFile(req, res);
	});

	this.router.route(/^\/(\w+)\/(\w+)\/(\w+)(?:\.rows)?$/)
		.get(function(req, res) {
			me.getRows(req, res);
		})
		.put(function(req, res) {
			me.putRows(req, res);
		})
		.post(function(req, res) {
			me.postRows(req, res);
		})
		.delete(function(req, res) {
			me.delRows(req, res);
		});

	this.router.get(/^\/(\w+)\/(\w+)\/(\w+).stats$/, function(req, res) {
		me.getStats(req, res);
	});

	log.debug("...Controller.initRoutes()");		
}

Controller.prototype.account = function(name) {
	return this.accounts[name];
}

Controller.prototype.getPathObjects = function(req, objs) {

	log.debug({params: req.params}, 'Controller.getPathObjects...');

	var result = {};
	if (req.params[0] && objs.account) {

		var account = this.account(req.params[0]);
		if ( ! account) {
			result.error = new Error('Account ' 
				+ req.params[0] + ' not found');
			return result;
		} else {
			result.account = account;
		}
	}

	if (req.params[1] && objs.db) {
		var db = result.account.database(req.params[1]);
		if ( ! db) {
			result.error = new Error('Database ' 
				+ req.params[1] + ' not found');
			return result;
		} else {
			result.db = db;
		}
	}

	if (req.params[2] && objs.table) {
		var table = result.db.table(req.params[2]);
		if ( ! table) {
			result.error = new Error('Table ' 
				+ req.params[2] + ' not found');
			return result;
		} else {
			result.table = table;
		}
	}

	log.debug({result: result}, '...Controller.getPathObjects');
	return result;
}

Controller.prototype.listAccounts = function(req, res) {
	log.info({req: req}, 'Controller.listAccounts()...');

	var result = {};
	result.accounts = _.map(this.accounts, function(ac) {
		return { name: ac.name,
				 url: '/' + ac.name
		};
	});

	res.send(result);
	log.info({req: req}, '...Controller.listAccounts()');
}

Controller.prototype.getAccount = function(req, res) {
	log.info({req: req}, 'Controller.getAccount()...');

	var path = this.getPathObjects(req, {account: true});
	if (path.error) {
		sendError(req, res, path.error, 404);
		return;
	}

	path.account.getInfo(function(err, result) {
		if (err) {
			sendError(req, res, err, 400);
			return;
		}

		result.url = '/' + path.account.name; 

		_.each(result.databases, function(db) {
			db.url = '/' + path.account.name + '/' + db.name;
		});

		log.trace(result);
		res.send(result); 
		log.info({res: res}, '...Controller.getAccount().');
	});
}

Controller.prototype.getDatabase = function(req, res) {

	log.info({req: req}, 'Controller.getDatabase()...');

	var path = this.getPathObjects(req, {account: true, db: true});
	if (path.error) {
		sendError(req, res, path.error, 404);
		return;
	}

	path.db.getInfo(function(err, result) {
		if (err) {
			sendError(req, res, err);
			return;
		}

		result.url = '/' + path.account.name + '/' + path.db.name();

		_.each(result.tables, function(t) {
			t.url = '/' + path.account.name 
					+ '/' + path.db.name() + '/' + t.name;
		});

		log.trace(result);
		res.send(result); 
		log.info({res: res}, '...Controller.getDatabase().');
	});
}

Controller.prototype.putDatabase = function(req, res) {
	log.info({req: req}, 'Controller.putDatabase()...');

	var path = this.getPathObjects(req, {account: true});
	if (path.error) {
		sendError(req, res, path.error, 404);
		return;
	}

	var schema = req.body;
	schema.name = req.params[1];

	path.account.createDatabase(schema, function(err, db) {
		if (err) {
			sendError(req, res, err, 400);
			return;
		}
		
		db.getInfo(function(err, result) {
			res.send(result);
		});
		log.info({res: res}, '...Controller.putDatabase().');
	});
}

Controller.prototype.delDatabase = function(req, res) {
	log.info({req: req}, 'Controller.delDatabase()...');

	var path = this.getPathObjects(req, {account: true, db: true});
	if (path.error) {
		sendError(req, res, path.error, 404);
		return;
	}

	var opts = req.query;
	path.account.delDatabase(path.db.name(), opts, function(err, sucess) {
		if (err) {
			sendError(req, res, err, 400);
			return;
		}

		res.send({});
		log.info('...Controller.delDatabase().');
	});
}

Controller.prototype.patchDatabase = function(req, res) {
	log.info({req: req}, 'Controller.patchDatabase()...');
	log.debug({'req.body': req.body});

	var path = this.getPathObjects(req, {account: true, db: true});
	if (path.error) {
		sendError(req, res, path.error, 404);
		return;
	}

	var patches = req.body;
	path.db.patchSchema(patches, function(err, result) {
		if (err) {
			sendError(req, res, err, 400);
			return;
		}
		log.debug({'res.body': result});
		res.send(result); 
		log.info({res: res}, '...Controller.patchDatabase().');
	});
}


Controller.prototype.getDatabaseFile = function(req, res) {
	log.info({req: req}, 'Controller.getDatabaseFile()...');

	var path = this.getPathObjects(req, {account: true, db: true});
	if (path.error) {
		sendError(req, res, path.error, 404);
		return;
	}

	res.sendFile(path.db.dbFile, function(err) {
		if (err) {
			sendError(req, res, err);
			return;
		}
		log.info({res: res}, '...Controller.getDatabaseFile().');
	});
}

Controller.prototype.getRows = function(req, res) {
	log.info({req: req}, 'Controller.getRows()...');

	var path = this.getPathObjects(req, {account: true, db: true, table: true});
	if (path.error) {
		sendError(req, res, path.error, 404);
		return;
	}

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

	path.db.all(path.table.name, {
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
				sendError(req, res, err, 400);
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
			log.info({res: res}, '...Controller.getRows().');
		}
	);
}

Controller.prototype.getStats = function(req, res) {
	log.info({req: req}, 'Controller.getStats()...');

	var path = this.getPathObjects(req, {account: true, db: true, table: true});
	if (path.error) {
		sendError(req, res, path.error, 404);
		return;
	}

	var params = {};
	_.each(req.query, function(v, k) {
		if (k[0] == '$') {
			var param = parser.parse(k + "=" + v);	
			params[param.name] = param.value;
		} else {
			params[k] = v;
		}
	});

	path.db.getStats(path.table.name, { 
			filter: params['$filter'], 
			fields: params['$select'] 
		}, 
		function(err, result) {
			if (err) {
				sendError(req, res, err, 400);
				return;
			}
			log.debug(result);
			res.send(result); 
			log.info({res: res}, '...Controller.getStats().');
		}
	);
}

//insert rows into table
Controller.prototype.postRows = function(req, res) {
	log.info({req: req}, 'Controller.postRows()...');
	log.debug({'req.body': req.body});

	var path = this.getPathObjects(req, {account: true, db: true, table: true});
	if (path.error) {
		sendError(req, res, path.error, 404);
		return;
	}

	var rows = req.body;
	var opts = req.query;
	path.db.insert(path.table.name, rows, opts, function(err, result) {
		if (err) {
			sendError(req, res, err, 400);
			return;
		}
		log.debug({'res.body': result});
		res.send(result); 
		log.info({res: res}, '...Controller.postRows().');
	});
}

//update rows in table
Controller.prototype.putRows = function(req, res) {
	log.info({req: req}, 'Controller.putRows()...');
	log.debug({'req.body': req.body});

	var path = this.getPathObjects(req, {account: true, db: true, table: true});
	if (path.error) {
		sendError(req, res, path.error, 404);
		return;
	}

	var rows = req.body;
	var opts = req.query;
	path.db.update(path.table.name, rows, opts, function(err, result) {
		if (err) {
			sendError(req, res, err, 400);
			return;
		}
		log.debug({'res.body': result});
		res.send(result);  
		log.info({res: res}, '...Controller.putRows().');
	});
}

//delete rows from table
Controller.prototype.delRows = function(req, res) {
	log.info({req: req}, 'Controller.delRows()...');
	log.debug({'req.body': req.body});

	var path = this.getPathObjects(req, {account: true, db: true, table: true});
	if (path.error) {
		sendError(req, res, path.error, 404);
		return;
	}

	var rowIds = req.body;
	path.db.delete(path.table.name, rowIds, function(err, result) {
		if (err) {
			sendError(req, res, err, 400);
			return;
		}
		res.send(result); 
		log.info({res: res}, '...Controller.delRows().');
	});
}

exports.Controller = Controller;

