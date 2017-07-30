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
var jwt = require('express-jwt');
var config = require('config');

var parser = require('./QueryParser.js');
var AccessControl = require('./AccessControl.js').AccessControl;
var Schema = require('./Schema.js').Schema;
var Table = require('./Table.js').Table;

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

	var nonceRoutes = _.values(Controller.NonceRoutes);

	//json parsing 
	var reqSizeLimit = options.bodyParser ? options.bodyParser.limit : '1mb';
	this.router.use(bodyParser.json({ limit: reqSizeLimit }));

	if (this.auth) {

		var auth_token = jwt({
			  secret: new Buffer(config.auth0.clientSecret, 'base64'),
			  audience: config.auth0.clientId,
		}).unless({path: nonceRoutes});

/** TODO
 * 
 * AAD does not use a secret but a public key to sign JWT
 * we need to 
 * 1) obtain kid value from the header of the JWT token 
 * 2) get data for all AAD keys from https://login.microsoftonline.com/common/discovery/v2.0/keys
 * 3) get correct key by mathcing the kid attributes to our kid value.
 * 4) get key.x5c[0] and put into public key format:
 *  	var pem = '-----BEGIN CERTIFICATE-----\n' + key.x5c[0].match(/.{1,64}/g).join('\n')
				+ '\n-----END CERTIFICATE-----\n' 	 
 * 5) now verify / decode our JWT calling jwt.verify(token, pem) 
 * TODO NOT SURE how to do all of this using the express middleware... 				
 */

		this.router.use(auth_token);
		
		this.router.use(function(req, res, next) {
			if (req.user && req.user.app_metadata) {
				req.user.account = req.user.app_metadata.account;
				req.user.root = req.user.app_metadata.root || false;
				req.user.admin = req.user.app_metadata.admin || false;
				req.user.name = req.user.email;
			} else {
				/* handle unauthenticated 
				 * needed for nonceRoutes that allow anonymous GET
				*/ 
				req.user = { name: 'unk' }; 
			}
			log.debug({'req.user': req.user}, 'router.use');
			next();
		});
		
	} else {
		this.router.use(function(req, res, next) {
			req.user = {
				name : req.query.user || 'unk'
			};
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
	this.access.authRequest('listAccounts', req, null).then((auth) => { 

		var result = me.accountManager.list();
	
		_.each(result.accounts, function(account) {
			account.url = '/' + account.name;
		});
	
		res.send(result);
		log.info({req: req}, '...Controller.listAccounts()');

	}).catch(err => {
		sendError(req, res, err, err.code || 500);
		return;
	});
}

Controller.prototype.putAccount = function(req, res) {
	log.info({req: req}, 'Controller.putAccount()...');
	var me = this;
	this.access.authRequest('putAccount', req, null).then((auth) => { 

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
		sendError(req, res, err, err.code || 500);
		return;
	});
}

Controller.prototype.getAccount = function(req, res) {
	log.info({req: req}, 'Controller.getAccount()...');
	var me = this;

	var path;

	this.getDataObjects(req, {account: true}).then((result) => {
		path = result;
		return me.access.authRequest('getAccount', req, path);
	
	}).then((auth) => { 

		path.account.getInfo(function(err, result) {
			if (err) {
				sendError(req, res, err, 400);
				return;
			}
	
			result.url = '/' + path.account.name; 

			result.databases = me.access.filterDatabases(path, result.databases, req.user);
			_.each(result.databases, function(db) {
				db.url = '/' + path.account.name + '/' + db.name;
			});

			log.trace(result);
			res.send(result); 
			log.info({req: req}, '...Controller.getAccount().');
		});

	}).catch(err => {
		sendError(req, res, err, err.code || 500);
		return;
	});		
}
	
Controller.prototype.getDatabase = function(req, res) {
	log.info({req: req}, 'Controller.getDatabase()...');

	var me = this;
	var path;

	this.getDataObjects(req, {account: true, db: true}).then((result) => {
		path = result;
		return me.access.authRequest('getDatabase', req, path);
	
	}).then((auth) => { 

		if (req.query.reload && parseInt(req.query.reload) > 0) {
			return path.db.reset();		
		} else {
			return Promise.resolve();
		}
		
	}).then(() => { 
		path.db.getInfo(function(err, result) {
			if (err) {
				sendError(req, res, err);
				return;
			}
	
			result.url = '/' + path.account.name + '/' + path.db.name();
	
			result.tables = me.access.filterTables(path, result.tables, req.user);
			_.each(result.tables, function(t) {
				t.url = '/' + path.account.name 
						+ '/' + path.db.name() + '/' + t.name;
			});

			log.trace(result);
			res.send(result); 
			log.info({req: req}, '...Controller.getDatabase().');
		});

	}).catch(err => {
		sendError(req, res, err, err.code || 500);
		return;
	});
}

Controller.prototype.putDatabase = function(req, res) {
	log.info({req: req}, 'Controller.putDatabase()...');

	var me = this;
	var path;

	this.getDataObjects(req, {account: true}).then((result) => {
		path = result;
		return me.access.authRequest('putDatabase', req, path);
	
	}).then((auth) => { 

		var schema = req.body;
		schema.name = req.params[1];
		Schema.setAdmin(schema, req.user.name);
	
		path.account.createDatabase(schema, function(err, db) {
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
		sendError(req, res, err, err.code || 500);
		return;
	});
}

Controller.prototype.delDatabase = function(req, res) {
	log.info({req: req}, 'Controller.delDatabase()...');

	var path;
	this.getDataObjects(req, {account: true, db: true}).then((result) => {
		path = result;
		return me.access.authRequest('delDatabase', req, path);
	
	}).then((auth) => { 

		var opts = req.query;
		path.account.delDatabase(path.db.name(), opts, function(err, success) {
			if (err) {
				sendError(req, res, err, 400);
				return;
			}
	
			res.send({});
			log.info('...Controller.delDatabase().');
		});
	}).catch(err => {
		sendError(req, res, err, err.code || 500);
		return;
	});
}

Controller.prototype.patchDatabase = function(req, res) {
	log.info({req: req}, 'Controller.patchDatabase()...');
	log.debug({'req.body': req.body});

	var path;
	this.getDataObjects(req, {account: true, db: true}).then((result) => {
		path = result;
		return me.access.authRequest('patchDatabase', req, path);
	
	}).then((auth) => { 

		var patches = req.body;
		path.db.patchSchema(patches, function(err, result) {
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
		sendError(req, res, err, err.code || 500);
		return;
	});
}

Controller.prototype.getCSVFile = function(req, res) {
	var me = this;
	log.info({req: req}, 'Controller.getCSVFile()...');

	var path;
	this.getDataObjects(req, {account: true, db: true, table: true}).then((result) => {
		path = result;
		return me.access.authRequest('getCSVFile', req, path);
	
	}).then((auth) => { 

		res.sendFile(me.access.getCSVFilename(req.query.nonce), function(err) {
			if (err) {
				sendError(req, res, err);
				return;
			}
			log.info({req: req}, '...Controller.getCSVFile().');
		});

	}).catch(err => {
		sendError(req, res, err, err.code || 500);
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
	}

	var path;
	this.getDataObjects(req, opts).then((result) => {
		path = result;
		return me.access.authRequest(op, req, path);
	
	}).then((auth) => { 

		return me.access.createNonce(op);

	}).then((nonce) => { 
		
		path.nonce = nonce;	
		me[op](req, path, function(err) {

			if (err) {
				sendError(req, res, err);
				return;
			}

			res.send({ nonce: nonce }); 
			log.info({req: req}, '...Controller.requestNonce().');
		});

	}).catch(err => {
		sendError(req, res, err, err.code || 500);
		return;
	});	
}

Controller.prototype.getRows = function(req, res) {
	log.info({req: req}, 'Controller.getRows()...');
	var reqTime = funcs.startHRTime();
	//console.dir(req);
	var me = this;
	var path;

	this.getDataObjects(req, {account: true, db: true, table: true}).then((result) => {
		path = result;
		return me.access.authRequest('getRows', req, path);

	}).then((auth) => {

		var params = me.parseQueryParameters(req);
		if (params.error) throw params.error;

		var q = { filter: params.values['$filter'], fields: params.values['$select'] };
		var auth2 = me.access.filterQuery(path, q, req.user);
		if (auth2.error) throw auth2.error;
		
		path.db.all(path.table.name, {
				filter: auth2.filter 
				, fields: params.values['$select'] 
				, order: params.values['$orderby'] 
				, limit: params.values['$top'] 
				, offset: params.values['$skip'] 
				, debug: params.values['debug']	
				, format: params.values['format']	
				, nocounts: params.values['nocounts']	
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
		sendError(req, res, err, err.code || 500);
		return;
	});


	log.debug('...Controller.getRows().');
}

Controller.prototype.getObjs = function(req, res) {
	log.info({req: req}, 'Controller.getObjs()...');
	var me = this;
	var path;

	this.getDataObjects(req, {account: true, db: true, table: true}).then((result) => {
		path = result;
		return me.access.authRequest('getObjs', req, path);

	}).then((auth) => {

		var params = me.parseQueryParameters(req);
		if (params.error) throw params.error;

		var q = { filter: params.values['$filter'], fields: params.values['$select'] };

		var auth2 = me.access.filterQuery(path, q, req.user);
		if (auth2.error) throw auth2.error;

		var fields = (params.values['$select'] || []);
		if ( ! _.find(fields, function(f) {
			return f.field == 'id' && (! f.table || f.table == path.table.name);
		})) {
			fields.push({ field: 'id' });
		}
		
		var orderBy = (params.values['$orderby'] || []).push({ field: 'id', order: 'asc' });
		
		path.db.all(path.table.name, {
				filter: auth2.filter 
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
				var objs = path.db.rowsToObj(result.rows, path.table.name);
				result.objs = objs;
				delete(result.rows);
	
				log.trace(result);
				res.send(result); 
				log.info({req: req}, '...Controller.getObjs().');
			}
		);
	}).catch(err => {
		sendError(req, res, err, err.code || 500);
		return;
	});
}

Controller.prototype.getStats = function(req, res) {
	log.info({req: req}, 'Controller.getStats()...');
	var me = this;
	var path;

	this.getDataObjects(req, {account: true, db: true, table: true}).then((result) => {
		path = result;
		return me.access.authRequest('getStats', req, path);

	}).then((auth) => {

		var params = me.parseQueryParameters(req);
		if (params.error) throw params.error;

		//TODO add access control filter
	
		path.db.getStats(path.table.name, { 
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
		sendError(req, res, err, err.code || 500);
		return;
	});
}

Controller.prototype.getViewRows = function(req, res) {
	log.info({req: req}, 'Controller.getViewRows()...');
	var reqTime = funcs.startHRTime();

	var me = this;
	var path;

	var viewName = req.params[2];
	if ( ! viewName) {
		sendError(req, res, new Error('Missing view parameter'), 404);
		return;
	}	
	
	this.getDataObjects(req, {account: true, db: true}).then((result) => {
		path = result;
		return me.access.authRequest('getViewRows', req, path);

	}).then((auth) => {

		var params = me.parseQueryParameters(req);
		if (params.error) throw params.error;

		path.db.allView(viewName, {
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
		sendError(req, res, err, err.code || 500);
		return;
	});
}

//insert rows into table
Controller.prototype.postRows = function(req, res) {
	var me = this;
	log.info({req: req}, 'Controller.postRows()...');
	log.debug({'req.body': req.body});

	var path;

	this.getDataObjects(req, {account: true, db: true, table: true}).then((result) => {
		path = result;
		return me.access.authRequest('postRows', req, path);

	}).then((auth) => {

		var rows = req.body;
		var opts = req.query;
		opts.user = req.user;
	
		var table_access = path.table.access(opts.user);
		if (table_access.write != Table.ROW_SCOPES.ALL) {
			me.stripOwnerField(rows);
		}

		path.db.insert(path.table.name, rows, opts, function(err, result) {
			if (err) {
				sendError(req, res, err, 400);
				return;
			}
			log.debug({'res.body': result});
			res.send(result); 
			log.info({req: req}, '...Controller.postRows().');
		});

	}).catch(err => {
		sendError(req, res, err, err.code || 500);
		return;
	});
}

//update rows in table
Controller.prototype.putRows = function(req, res) {
	var me = this;
	log.info({req: req}, 'Controller.putRows()...');
	log.debug({'req.body': req.body});

	this.getDataObjects(req, {account: true, db: true, table: true}).then((result) => {
		path = result;
		return me.access.authRequest('putRows', req, path);

	}).then((auth) => {

		var rows = req.body;
		var opts = req.query;
		opts.user = req.user;
	
		var table_access = path.table.access(opts.user);
		if (table_access.write != Table.ROW_SCOPES.ALL) {
			me.stripOwnerField(rows);
		}

		path.db.update(path.table.name, rows, opts, function(err, result) {
			if (err) {
				sendError(req, res, err, 400);
				return;
			}

			log.debug({'res.body': result});
			res.send(result);  
			log.info({req: req}, '...Controller.putRows().');
		});

	}).catch(err => {
		sendError(req, res, err, err.code || 500);
		return;
	});
}

//delete rows from table
Controller.prototype.delRows = function(req, res) {
	log.info({req: req}, 'Controller.delRows()...');
	log.debug({'req.body': req.body});

	this.getDataObjects(req, {account: true, db: true, table: true}).then((result) => {
		path = result;
		return me.access.authRequest('delRows', req, path);

	}).then((auth) => {

		var rowIds = req.body;
		path.db.delete(path.table.name, rowIds, function(err, result) {
			if (err) {
				sendError(req, res, err, 400);
				return;
			}
			res.send(result); 
			log.info({req: req}, '...Controller.delRows().');
		});

	}).catch(err => {
		sendError(req, res, err, err.code || 500);
		return;
	});
}

//chown (change owner) of rows. deep, includes rows from all descendant tables
Controller.prototype.chownRows = function(req, res) {
	log.info({req: req}, 'Controller.chownRows()...');
	log.debug({'req.body': req.body});

	this.getDataObjects(req, {account: true, db: true, table: true}).then((result) => {
		path = result;
		return me.access.authRequest('chownRows', req, path);

	}).then((auth) => {

		var owner = req.query.owner;
		if ( ! owner) throw new Error('missing owner query parameter');

		var rowIds = req.body;
		path.db.chown(path.table.name, rowIds, owner, function(err, result) {
			if (err) {
				sendError(req, res, err, 400);
				return;
			}
			res.send(result); 
			log.info({req: req}, '...Controller.chownRows().');
		});

	}).catch(err => {
		sendError(req, res, err, err.code || 500);
		return;
	});
}

//end request handler methods.

//private methods

var fs = require('fs');

Controller.prototype.generateCSVFile = function(req, path, cbAfter) {
	var content = 'Soon...' + JSON.stringify(req.body);
	fs.writeFile(this.access.getCSVFilename(path.nonce), content, function(err) {
		cbAfter(err);
	});
}

Controller.QUERY_PARAMS = {
	'integer': ['debug', 'nocounts']
};

Controller.prototype.parseQueryParameters = function(req) {
	var error;
	var params = {};
	_.each(req.query, function(v, k) {
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

function sendError(req, res, err, code) {
	code = code || 500;
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

	return new Promise(function(resolve, reject) {
		var result = {};
		if (objs.account) {
			result.account = me.account(req.params[0]);
			if ( ! result.account) {
				var err = new Error("Account '" + req.params[0] + "' not found");
				return reject(err);
			}
		} else {
			resolve(result);
		}

		if (objs.db) {
			result.db = result.account.database(req.params[1]);
			if ( ! result.db) {
				var err = new Error("Database '" + req.params[1] + "' not found");
				return reject(err);
			}
			
			result.db.init().then(() => {
				if (req.params[2] && objs.table) {
					result.table = result.db.table(req.params[2]);
					if ( ! result.table) {
						var err = new Error("Table '" + req.params[2] + " not found");
						return reject(err);
					}
				}
				resolve(result);

			}).catch(err => {
				log.error({err: err}, "Database.init() exception.");
				reject(err);
			});

		} else {
			resolve(result);
		}
		
	});
}

Controller.NonceRoutes = {
	TABLE_CSV_FILE: /^\/(\w+)\/(\w+)\/(\w+)\.csv?/   	//get table csv file
};

exports.ApiController = Controller;

