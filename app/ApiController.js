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
var util = require('util');
var url = require('url');
var express = require('express');
var bodyParser = require('body-parser');
var config = require('config');

//var jwt = require('express-jwt'); //Auth0
var jwt = require('azure-ad-jwt');	//AAD

var parser = require('./QueryParser.js');
var AccessControl = require('./AccessControl.js').AccessControl;
var Schema = require('./Schema.js').Schema;
var Table = require('./Table.js').Table;
var Field = require('./Field.js').Field;
var User = require('./User.js').User;

var log = require('./log.js').log;
var funcs = require('./funcs.js');

function Controller(accountManager, options) {
	options = options || {};
	this.auth = options.auth || false;
	this.accountManager = accountManager;
	this.router = new express.Router();
	this.access = new AccessControl({ auth: this.auth });
	this.initRoutes(options);
}

Controller.prototype.initRoutes = function(options) {
	log.trace("Controller.initRoutes()...");		
	var me = this;

	var reqSizeLimit = options.bodyParser ? options.bodyParser.limit : '1mb';

	//json parsing 
	this.router.use(bodyParser.json({ limit: reqSizeLimit }));
	//urlencoded parsing (used by POST requests to add/mod/del rows)
	this.router.use(bodyParser.urlencoded({ limit: reqSizeLimit, extended: true }));

	if (this.auth) {

		var isNonceRoute = function(path) {
			var result = _.find(_.values(Controller.NonceRoutes), function(regExp) {
				return path.match(regExp);
			});					
			return !! result;
		};
	
		this.router.use(function(req, res, next) {

			if (isNonceRoute(req.path)) {
				log.debug({path: req.path}, 'Nonce request.. pass through');
				next();
				return;
			}

			//pick up identity
			if (req.header('x-ms-client-principal-name')) {
				req.user = new User(req.header('x-ms-client-principal-name'), me.accountManager.masterDatabase());
				next();			
				return;
			}

			//decode AAD Authorization token
			var token = req.header('Authorization');
			if (token && token.startsWith('Bearer ')) {
				log.debug({jwt: token}, 'Authorization token');
				jwt.verify(token.substr('Bearer '.length), null, function(err, result) {
					if (err) {
						log.error({err: err}, 'Authorization token');
						sendError(req, res, new Error("Authorization token '" + token + "' not valid"), 401);
						return;
					}
					req.user = new User(result.upn, me.accountManager.masterDatabase());
					next();
				});

			} else {
				//for testing, we supply user on query string ?user=dkottow@golder.com
				log.error('Authorization token missing');
				sendError(req, res, new Error("Authorization token missing"), 401);
				return;
			}

		});

	} else {
		this.router.use(function(req, res, next) {
			req.user = new User(User.NOBODY);
			next();
		});
	}
	

	this.router.get('/', function(req, res) {
		me.listAccounts(req, res);
	});

	this.router.put(/^\/(\w+)$/, function(req, res) {
		me.putAccount(req, res);
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

	this.router.get(Controller.NonceRoutes.TABLE_CSV_FILE, function(req, res) {
		me.getCSVFile(req, res);
	});
	
	this.router.post(/^\/(\w+)\/(\w+)\.nonce$/, function(req, res) {
		me.doNonceRequest(req, res);
	});

	this.router.post(/^\/(\w+)\/(\w+)\/(\w+)\.nonce$/, function(req, res) {
		me.doNonceRequest(req, res);
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

	this.router.post(/^\/(\w+)\/(\w+)\/(\w+)\.mod_rows$/, function(req, res) {
		me.putRows(req, res);
	});

	this.router.post(/^\/(\w+)\/(\w+)\/(\w+)\.add_rows$/, function(req, res) {
		me.postRows(req, res);
	});
	
	this.router.post(/^\/(\w+)\/(\w+)\/(\w+)\.del_rows$/, function(req, res) {
		me.delRows(req, res);
	});

	this.router.get(/^\/(\w+)\/(\w+)\/(\w+).stats$/, function(req, res) {
		me.getStats(req, res);
	});

	this.router.get(/^\/(\w+)\/(\w+)\/(\w+).objs$/, function(req, res) {
		me.getObjs(req, res);
	});

	this.router.get(/^\/(\w+)\/(\w+)\/(\w+).view$/, function(req, res) {
		me.getViewRows(req, res);
	});
	
	this.router.put(/^\/(\w+)\/(\w+)\/(\w+).chown$/, function(req, res) {
		me.chownRows(req, res);
	});

	log.trace("...Controller.initRoutes()");		
}

//start request handler methods.

Controller.prototype.listAccounts = function(req, res) {
	log.info({req: req}, 'Controller.listAccounts()...');

	var me = this;
	this.access.authorize('listAccounts', req, null).then((access) => { 

		var result = me.accountManager.list();
	
		_.each(result.accounts, function(account) {
			account.url = '/' + account.name;
		});
	
		res.send(result);
		log.info({req: req}, '...Controller.listAccounts()');

	}).catch(err => {
		sendError(req, res, err);
		return;
	});
}

Controller.prototype.putAccount = function(req, res) {
	log.info({req: req}, 'Controller.putAccount()...');
	var me = this;
	this.access.authorize('putAccount', req, null).then((access) => { 

		me.accountManager.create(req.params[0], function(err, result) {
			if (err) {
				sendError(req, res, err, 400);
				return;
			}
			log.trace(result);
			res.send(result); 
			log.info({req: req}, '...Controller.putAccount().');
		});
	}).catch(err => {
		sendError(req, res, err);
		return;
	});
}

Controller.prototype.getAccount = function(req, res) {
	log.info({req: req}, 'Controller.getAccount()...');
	var me = this;

	var data;

	this.getDataObjects(req, {account: true}).then((result) => {
		data = result;
		//return Promise.reject(new Error('testing error'));
		return me.access.authorize('getAccount', req, result);
	
	}).then((access) => { 

		data.account.getInfo(function(err, result) {
			if (err) {
				sendError(req, res, err, 400);
				return;
			}
	
			result.url = '/' + data.account.name; 

			//result.databases = me.access.filterDatabases(data, result.databases, req.user);
			_.each(result.databases, function(db) {
				db.url = '/' + data.account.name + '/' + db.name;
			});

			log.trace(result);
			res.send(result); 
			log.info({req: req}, '...Controller.getAccount().');
		});

	}).catch(err => {
		sendError(req, res, err);
		return;
	});		
}
	
Controller.prototype.getDatabase = function(req, res) {
	log.info({req: req}, 'Controller.getDatabase()...');

	var me = this;
	var data;

	this.getDataObjects(req, {account: true, db: true}).then((result) => {
		data = result;
		return me.access.authorize('getDatabase', req, result);
	
	}).then((access) => { 

		if (parseInt(req.query.reload) > 0) {
			return data.db.reset();		
		} else {
			return Promise.resolve();
		}
		
	}).then(() => { 
		var opts = {
			counts: parseInt(req.query.counts) > 0
		};		
		data.db.getInfo(opts, function(err, result) {
			if (err) {
				sendError(req, res, err);
				return;
			}
	
			result.url = '/' + data.account.name + '/' + data.db.name();
	
			//result.tables = me.access.filterTables(data, result.tables, req.user);
			_.each(result.tables, function(t) {
				t.url = '/' + data.account.name 
						+ '/' + data.db.name() + '/' + t.name;
			});

			result.login = {
				user: req.user.name(),
				principal: req.user.principal(),
				timestamp: Field.dateToString(new Date())
			}

			log.trace(result);
			res.send(result); 
			log.info({req: req}, '...Controller.getDatabase().');
		});

	}).catch(err => {
		sendError(req, res, err);
		return;
	});
}

Controller.prototype.putDatabase = function(req, res) {
	log.info({req: req}, 'Controller.putDatabase()...');

	var me = this;
	var data;

	this.getDataObjects(req, {account: true}).then((result) => {
		data = result;
		return me.access.authorize('putDatabase', req, data);
	
	}).then((access) => { 

		var schema = req.body;
		schema.name = req.params[1];
		//TODO Schema.setAdmin(schema, req.user.name);
	
		data.account.createDatabase(schema, function(err, db) {
			if (err) {
				sendError(req, res, err, 400);
				return;
			}
			
			db.getInfo(function(err, result) {
				res.send(result);
			});
			log.info({req: req}, '...Controller.putDatabase().');
		});

	}).catch(err => {
		sendError(req, res, err);
		return;
	});
}

Controller.prototype.delDatabase = function(req, res) {
	var me = this;
	log.info({req: req}, 'Controller.delDatabase()...');

	var data;
	this.getDataObjects(req, {account: true, db: true}).then((result) => {
		data = result;
		return me.access.authorize('delDatabase', req, data);
	
	}).then((access) => { 

		var opts = _.clone(req.query);
		data.account.delDatabase(data.db.name(), opts, function(err, success) {
			if (err) {
				sendError(req, res, err, 400);
				return;
			}
	
			res.send({});
			log.info('...Controller.delDatabase().');
		});
	}).catch(err => {
		sendError(req, res, err);
		return;
	});
}

Controller.prototype.patchDatabase = function(req, res) {
	var me = this;
	log.info({req: req}, 'Controller.patchDatabase()...');
	log.debug({'req.body': req.body});

	var data;
	this.getDataObjects(req, {account: true, db: true}).then((result) => {
		data = result;
		return me.access.authorize('patchDatabase', req, data);
	
	}).then((access) => { 

		var patches = req.body;
		data.db.patchSchema(patches, function(err, result) {
			if (err) {
				//dont simply sendError but send old schema	as well
				log.error({req: req, code: 400, err: err}, 'Controller.sendError()');
				res.status(400).send({error: err.message, schema: result});
				return;
			}
			log.trace({'res.body': result});
			res.send(result); 
			log.info({req: req}, '...Controller.patchDatabase().');
		});

	}).catch(err => {
		sendError(req, res, err);
		return;
	});
}

Controller.prototype.getCSVFile = function(req, res) {
	var me = this;
	log.info({req: req}, 'Controller.getCSVFile()...');

	var data;
	this.getDataObjects(req, {account: true, db: true, table: true}).then((result) => {
		data = result;
		return me.access.authorize('getCSVFile', req, data);
	
	}).then((access) => { 
		res.sendFile(me.access.getNoncePath(req.query.nonce, "csv"), function(err) {
			if (err) {
				sendError(req, res, err);
				return;
			}
			me.access.deleteNonceFile(req.query.nonce, "csv"); //returns promise we don't have to await.
			log.info({req: req}, '...Controller.getCSVFile().');
		});

	}).catch(err => {
		sendError(req, res, err);
		return;
	});
}

Controller.prototype.doNonceRequest = function(req, res) {
	log.info({req: req, path: req.body.path}, 'Controller.doNonceRequest()...');

	var me = this;
	var op, opts;

	if (req.body.path.match(Controller.NonceRoutes.TABLE_CSV_FILE)) {
		op = 'generateCSVFile';
		opts = {account: true, db: true, table: true };
	} else {
		var err = new Error("unknown nonce operation '" + req.body.path + "'");
		sendError(req, res, err, 400);
		return;		
	}

	var data;
	this.getDataObjects(req, opts).then((result) => {
		data = result;
		return me.access.authorize(op, req, data);
	
	}).then((access) => { 
		return me.access.createNonce(op);

	}).then((nonce) => { 
		
		data.nonce = nonce;	
		me[op](req, data, function(err) {

			if (err) {
				sendError(req, res, err);
				return;
			}

			res.send({ nonce: nonce }); 
			log.info({req: req}, '...Controller.requestNonce().');
		});

	}).catch(err => {
		sendError(req, res, err);
		return;
	});	
}

Controller.prototype.getRows = function(req, res) {
	log.info({req: req}, 'Controller.getRows()...');
	var reqTime = funcs.startHRTime();
	//console.dir(req);
	var me = this;
	var params;
	var data;

	this.getDataObjects(req, {account: true, db: true, table: true}).then((result) => {
		data = result;
		return me.access.authorize('getRows', req, data);

	}).then((access) => {

		params = me.parseQueryParameters(req.query);
		if (params.error) throw params.error;

		var q = { filter: params.values['$filter'], fields: params.values['$select'] };
		return me.access.filterQuery(data, q, req.user);

	}).then((filter) => {

		data.db.all(data.table.name, {
			filter: filter 
			, fields: params.values['$select'] 
			, order: params.values['$orderby'] 
			, limit: params.values['$top'] 
			, offset: params.values['$skip'] 
			, debug: params.values['debug']	
			, format: params.values['format']	
			, counts: params.values['counts']	
		},

			function(err, result) { 
				if (err) {
					sendError(req, res, err, 400);
					return;
				}

				//add nextUrl if nextOffset
				if (result.nextOffset) {
					result.nextUrl = me.nextUrl(req, result.nextOffset);
				}

				log.trace(result);
				res.send(result); 
				funcs.stopHRTime(reqTime);
				log.info({req: req, time: reqTime.secs}, '...Controller.getRows().');
			}
		);

	}).catch(err => {
		sendError(req, res, err);
		return;
	});

	log.debug('...Controller.getRows().');
}

Controller.prototype.getObjs = function(req, res) {
	log.info({req: req}, 'Controller.getObjs()...');
	var me = this;
	var params;
	var fields
	var data;

	this.getDataObjects(req, {account: true, db: true, table: true}).then((result) => {
		data = result;
		return me.access.authorize('getObjs', req, data);

	}).then((access) => {

		params = me.parseQueryParameters(req.query);
		if (params.error) throw params.error;

		fields = (params.values['$select'] || []);
		if ( ! _.find(fields, function(f) {
			return f.field == 'id' && (! f.table || f.table == data.table.name);
		})) {
			fields.push({ field: 'id' });
		}
		
		var q = { filter: params.values['$filter'], fields: fields };
		return me.access.filterQuery(data, q, req.user);

	}).then((filter) => {

		var orderBy = (params.values['$orderby'] || []).push({ field: 'id', order: 'asc' });
		
		data.db.all(data.table.name, {
				filter: filter 
				, fields: fields 
				, order: orderBy 
				, limit: params.values['$top'] 
				, offset: params.values['$skip'] 
				, debug: params.values['debug']	
			},
	
			function(err, result) { 
				if (err) {
					sendError(req, res, err, 400);
					return;
				}
	
				//remove rows of probably incomplete last object
				if (result.nextOffset) {
					var i = result.rows.length - 1;
					var lastId = result.rows[i].id;
					var lastOffset = params.values['$skip'] ? params.values['$skip'] : 0;
					while(--i >= 0) {
						if (result.rows[i].id != lastId) {
							result.rows.splice(i + 1);
							result.nextOffset = lastOffset 
								+ result.rows.length;
						//console.log(util.inspect(_.pluck(result.rows, 'id')));
							break;					
						}
					}
				}

				//add nextUrl if nextOffset
				if (result.nextOffset) {
					result.nextUrl = me.nextUrl(req, result.nextOffset);
				}
	
				//build objects
				var objs = data.db.rowsToObj(result.rows, data.table.name);
				result.objs = objs;
				delete(result.rows);
	
				log.trace(result);
				res.send(result); 
				log.info({req: req}, '...Controller.getObjs().');
			}
		);
	}).catch(err => {
		sendError(req, res, err);
		return;
	});
}

Controller.prototype.getStats = function(req, res) {
	log.info({req: req}, 'Controller.getStats()...');
	var me = this;
	var data;

	this.getDataObjects(req, {account: true, db: true, table: true}).then((result) => {
		data = result;
		return me.access.authorize('getStats', req, data);

	}).then((access) => {

		var params = me.parseQueryParameters(req.query);
		if (params.error) throw params.error;

		//TODO add access control filter
	
		data.db.getStats(data.table.name, { 
				filter: params.values['$filter'], 
				fields: params.values['$select'] 
			}, 
			function(err, result) {
				if (err) {
					sendError(req, res, err, 400);
					return;
				}
				log.trace(result);
				res.send(result); 
				log.info({req: req}, '...Controller.getStats().');
			}
		);
	}).catch(err => {
		sendError(req, res, err);
		return;
	});
}

Controller.prototype.getViewRows = function(req, res) {
	log.info({req: req}, 'Controller.getViewRows()...');
	var reqTime = funcs.startHRTime();

	var me = this;
	var data;

	var viewName = req.params[2];
	if ( ! viewName) {
		sendError(req, res, new Error('Missing view parameter'), 404);
		return;
	}	
	
	this.getDataObjects(req, {account: true, db: true}).then((result) => {
		data = result;
		return me.access.authorize('getViewRows', req, data);

	}).then((access) => {

		var params = me.parseQueryParameters(req.query);
		if (params.error) throw params.error;

		data.db.allView(viewName, {
				filter: params.values['$filter'] 
				, fields: params.values['$select'] 
				, order: params.values['$orderby'] 
				, limit: params.values['$top'] 
				, offset: params.values['$skip'] 
				, debug: params.values['debug']	
				, format: params.values['format']	
			},
	
			function(err, result) { 
				if (err) {
					sendError(req, res, err, 400);
					return;
				}
	
				log.trace(result);
				res.send(result); 
				funcs.stopHRTime(reqTime);
				log.info({req: req, time: reqTime.secs}, '...Controller.getViewRows().');
			}
		);
	}).catch(err => {
		sendError(req, res, err);
		return;
	});
}

//insert rows into table
Controller.prototype.postRows = function(req, res) {
	var me = this;
	log.info({req: req}, 'Controller.postRows()...');
	log.debug({'req.body': req.body});

	var data;

	this.getDataObjects(req, {account: true, db: true, table: true}).then((result) => {
		data = result;
		return me.access.authorize('postRows', req, data);

	}).then((access) => {

		var rows = me.getRowsFromBody(req);
	
		//only users with full write access to table are allowed to set owner
		if (access.Write == Table.ROW_SCOPES.OWN) {
			rows = me.stripOwnerField(rows);
		}

		var opts = _.clone(req.query);
		opts.user = req.user;
		data.db.insert(data.table.name, rows, opts, function(err, result) {
			if (err) {
				sendError(req, res, err, 400);
				return;
			}
			log.debug({'res.body': result});
			res.send(result); 
			log.info({req: req}, '...Controller.postRows().');
		});

	}).catch(err => {
		sendError(req, res, err);
		return;
	});
}

//update rows in table
Controller.prototype.putRows = function(req, res) {
	var me = this;
	log.info({req: req}, 'Controller.putRows()...');
	log.debug({'req.body': req.body});

	this.getDataObjects(req, {account: true, db: true, table: true}).then((result) => {
		data = result;
		return me.access.authorize('putRows', req, data);

	}).then((access) => {

		var rows = me.getRowsFromBody(req);

		//only users with full write access to table are allowed to set owner
		if (access.Write == Table.ROW_SCOPES.OWN) {
			rows = me.stripOwnerField(rows);
		}

		var opts = _.clone(req.query);
		opts.user = req.user;
		data.db.update(data.table.name, rows, opts, function(err, result) {
			if (err) {
				sendError(req, res, err, 400);
				return;
			}

			log.debug({'res.body': result});
			res.send(result);  
			log.info({req: req}, '...Controller.putRows().');
		});

	}).catch(err => {
		sendError(req, res, err);
		return;
	});
}

//delete rows from table
Controller.prototype.delRows = function(req, res) {
	log.info({req: req}, 'Controller.delRows()...');
	log.debug({'req.body': req.body});
	var me = this;

	this.getDataObjects(req, {account: true, db: true, table: true}).then((result) => {
		data = result;
		return me.access.authorize('delRows', req, data);

	}).then((access) => {

		var rowIds = me.getRowsFromBody(req);
		
		data.db.delete(data.table.name, rowIds, function(err, result) {
			if (err) {
				sendError(req, res, err, 400);
				return;
			}
			res.send(result); 
			log.info({req: req}, '...Controller.delRows().');
		});

	}).catch(err => {
		sendError(req, res, err);
		return;
	});
}

//chown (change owner) of rows. deep, includes rows from all descendant tables
Controller.prototype.chownRows = function(req, res) {
	log.info({req: req}, 'Controller.chownRows()...');
	log.debug({'req.body': req.body});
	var me = this;

	this.getDataObjects(req, {account: true, db: true, table: true}).then((result) => {
		data = result;
		return me.access.authorize('chownRows', req, data);

	}).then((access) => {

		var owner = req.query.owner;
		if ( ! owner) throw new Error('missing owner query parameter');

		var rowIds = req.body;
		data.db.chown(data.table.name, rowIds, owner, function(err, result) {
			if (err) {
				sendError(req, res, err, 400);
				return;
			}
			res.send(result); 
			log.info({req: req}, '...Controller.chownRows().');
		});

	}).catch(err => {
		sendError(req, res, err);
		return;
	});
}

//end request handler methods.

//private methods

var fs = require('fs');

Controller.prototype.generateCSVFile = function(req, data, cbAfter) {
	var me = this;

	var urlObj = url.parse(req.body.path, true);
	var params = me.parseQueryParameters(urlObj.query);
	if (params.error) {
		cbAfter(params.error);
		return;
	}

	var q = { filter: params.values['$filter'], fields: params.values['$select'] };

	me.access.filterQuery(data, q, req.user).then((filter) => {

		var limit = params.values['$top'] || 1000000; //max 1M rows

		data.db.all(data.table.name, {
			filter: filter 
			, fields: params.values['$select'] 
			, order: params.values['$orderby'] 
			, limit: limit 
			, format: 'csv'	
		},

			function(err, result) { 
				if (err) {
					cbAfter(err);
					return;
				}

				var content = result;
				fs.writeFile(me.access.getNoncePath(data.nonce, "csv"), content, function(err) {
					cbAfter(err);
					log.info({ req: req }, '...Controller.generateCSVFile().');
				});							
			}
		);

	}).catch(err => {
		cbAfter(err);
		return;
	});

	log.debug('...Controller.generateCSVFile().');
}

Controller.QUERY_PARAMS = {
	'integer': ['debug', 'counts']
};

Controller.prototype.parseQueryParameters = function(queryObj) {
	var error;
	var params = {};
	_.each(queryObj, function(v, k) {
		try {
			if (k[0] == '$') {
				var param = parser.parse(k + "=" + v);	
				params[param.name] = param.value;
			} else if (_.contains(Controller.QUERY_PARAMS.integer, k)) {
				params[k] = parseInt(v);
			} else {
				params[k] = v;
			}
		} catch(err) {
			var pegErr = err.message.replace(/\"/g, "'"); //pegjs errors enclose literals in double quotes
			err.message = util.format("Error parsing param[%s] = '%s'. %s", k, v, pegErr);  
			err.code = 400;
			error = err;
		}
	});
	log.trace({params: params});	
	return { error: error, values: params };
}

Controller.prototype.nextUrl = function(req, offset) {
	var urlObj = url.parse(req.url, true);
	urlObj.search = undefined;
	urlObj.query['$skip'] = offset;
	return url.format(urlObj)
}

Controller.prototype.stripOwnerField = function(rows) {
	return _.map(rows, function(row) {
		return _.omit(row, 'own_by');
	});
}

Controller.prototype.getRowsFromBody = function(req) {
	if (_.isArray(req.body)) return req.body;
	if (_.isArray(req.body.rows)) return req.body.rows;
	return [];
}

function sendError(req, res, err, code) {
	if (parseInt(err.code) > 0) code = err.code;
	else code = code || 500;

	if (code >= 500) {
		log.error({code: code, err: err, req: req}, err.message);
	} else {
		log.warn({code: code, err: err, req: req}, err.message);
	}

	res.status(code).send({error: err.message});
}


Controller.prototype.account = function(name) {
	return this.accountManager.get(name);
}

Controller.prototype.getDataObjects = function(req, objs) {
	var me = this;
	log.trace({params: req.params}, 'Controller.getDataObjects...');

	var result = {};
	if (! objs.account) {
		return Promise.resolve(result);
	}


	//TODO hack to redirect test/_d365Master to _d365/_d365Master
	if (req.params[0] == 'test' && req.params[1] == '_d365Master') {	
		log.warn("epic hack to redirect to _d365/_d365Master");
		req.params[0] = '_d365';
	}

	result.account = me.account(req.params[0]);
	if ( ! result.account) {
		var err = new Error("Account '" + req.params[0] + "' not found");
		err.code = 404;
		return Promise.reject(err);
	}

	if (! objs.db) {
		return Promise.resolve(result);
	}

	result.db = result.account.database(req.params[1]);
	if ( ! result.db) {
		var err = new Error("Database '" + req.params[1] + "' not found");
		err.code = 404;
		return Promise.reject(err);
	}

	return result.db.init().then(() => {
		if (! objs.table) {
			return Promise.resolve(result);
		}

		result.table = result.db.table(req.params[2]);
		if ( ! result.table) {
			var err = new Error("Table '" + req.params[2] + " not found");
			err.code = 404;
			return Promise.reject(err);
		}

		return Promise.resolve(result);
	});
}

Controller.NonceRoutes = {
	TABLE_CSV_FILE: /^\/(\w+)\/(\w+)\/(\w+)\.csv/   	//get table csv file
};

exports.ApiController = Controller;

