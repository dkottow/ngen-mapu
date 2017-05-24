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

var parser = require('./QueryParser.js');
var AccessControl = require('./AccessControl.js').AccessControl;
var Schema = require('./Schema.js').Schema;
var Table = require('./Table.js').Table;

var log = require('./log.js').log;


/*
var envPath = './.env'; 
if (process.env.OPENSHIFT_DATA_DIR) { 
    envPath = process.env.OPENSHIFT_DATA_DIR + '/.env'; 
} 
 
require('dotenv').config({path: envPath}); 
*/

function sendError(req, res, err, code) {
	log.error({req: req, code: code, err: err}, 'Controller.sendError()');
	code = code || 500;
	res.status(code).send({error: err.message});
}

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

	var nonceRoutes = [ 
		/^\/(\w+)\/(\w+)\.sqlite?$/ //get database file
	]; 		

	//json parsing 
	var reqSizeLimit = options.bodyParser ? options.bodyParser.limit : '1mb';
	this.router.use(bodyParser.json({ limit: reqSizeLimit }));

	if (this.auth) {

		var auth_token = jwt({
			  secret: new Buffer(process.env.AUTH0_CLIENT_SECRET, 'base64'),
			  audience: process.env.AUTH0_CLIENT_ID,
		}).unless({path: nonceRoutes});

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
				account : "demo",
				name : "demo@donkeylift.com"
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

	this.router.get(/^\/(\w+)\/(\w+)\.sqlite$/, function(req, res) {
		me.getDatabaseFile(req, res);
	});

	this.router.post(/^\/(\w+)\/(\w+)\.nonce$/, function(req, res) {
		me.requestNonce(req, res);
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

	this.router.put(/^\/(\w+)\/(\w+)\/(\w+).chown$/, function(req, res) {
		me.chownRows(req, res);
	});

	log.trace("...Controller.initRoutes()");		
}

Controller.prototype.listAccounts = function(req, res) {
	log.info({req: req}, 'Controller.listAccounts()...');

	var me = this;
	this.access.authRequest('listAccounts', req, null, function(err, auth) {
		if (err) {
			sendError(req, res, err, 400);
			return;
		}
		
		if (auth.error) {
			sendError(req, res, auth.error, 401);
			return;
		}
		
		var result = me.accountManager.list();
	
		_.each(result.accounts, function(account) {
			account.url = '/' + account.name;
		});
	
		res.send(result);
		log.info({req: req}, '...Controller.listAccounts()');
	});

}

Controller.prototype.putAccount = function(req, res) {
	log.info({req: req}, 'Controller.putAccount()...');
	var me = this;
	this.access.authRequest('putAccount', req, null, function(err, auth) {
		if (err) {
			sendError(req, res, err, 400);
			return;
		}

		if (auth.error) {
			sendError(req, res, auth.error, 401);
			return;
		}
	
		me.accountManager.create(req.params[0], function(err, result) {
			if (err) {
				sendError(req, res, err, 400);
				return;
			}
			log.trace(result);
			res.send(result); 
			log.info({req: req}, '...Controller.putAccount().');
		});
	});
}

Controller.prototype.getAccount = function(req, res) {
	log.info({req: req}, 'Controller.getAccount()...');
	var me = this;
	var path = this.getPathObjects(req, {account: true});
	if (path.error) {
		sendError(req, res, path.error, 404);
		return;
	}

	this.access.authRequest('getAccount', req, path, function(err, auth) {
		if (err) {
			sendError(req, res, err, 400);
			return;
		}

		if (auth.error) {
			sendError(req, res, auth.error, 401);
			return;
		}
	
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

	});		
}
	
Controller.prototype.getDatabase = function(req, res) {
	log.info({req: req}, 'Controller.getDatabase()...');
	var me = this;
	var path = this.getPathObjects(req, {account: true, db: true});
	if (path.error) {
		sendError(req, res, path.error, 404);
		return;
	}

	this.access.authRequest('getDatabase', req, path, function(err, auth) {
		if (err) {
			sendError(req, res, err, 400);
			return;
		}

		if (auth.error) {
			sendError(req, res, auth.error, 401);
			return;
		}
	
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
	});
}

Controller.prototype.putDatabase = function(req, res) {
	log.info({req: req}, 'Controller.putDatabase()...');

	var path = this.getPathObjects(req, {account: true});
	if (path.error) {
		sendError(req, res, path.error, 404);
		return;
	}

	this.access.authRequest('putDatabase', req, path, function(err, auth) {
		if (err) {
			sendError(req, res, err, 400);
			return;
		}

		if (auth.error) {
			sendError(req, res, auth.error, 401);
			return;
		}
	
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
	});
}

Controller.prototype.delDatabase = function(req, res) {
	log.info({req: req}, 'Controller.delDatabase()...');

	var path = this.getPathObjects(req, {account: true, db: true});
	if (path.error) {
		sendError(req, res, path.error, 404);
		return;
	}

	this.access.authRequest('delDatabase', req, path, function(err, auth) {
		if (err) {
			sendError(req, res, err, 400);
			return;
		}
		
		if (auth.error) {
			sendError(req, res, auth.error, 401);
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

	this.access.authRequest('patchDatabase', req, path, function(err, auth) {
		if (err) {
			sendError(req, res, err, 400);
			return;
		}

		if (auth.error) {
			sendError(req, res, auth.error, 401);
			return;
		}
	
		var patches = req.body;
		path.db.patchSchema(patches, function(err, result) {
			if (err) {
				sendError(req, res, err, 400);
				return;
			}
			log.trace({'res.body': result});
			res.send(result); 
			log.info({req: req}, '...Controller.patchDatabase().');
		});
	});
}


Controller.prototype.getDatabaseFile = function(req, res) {
	log.info({req: req}, 'Controller.getDatabaseFile()...');

	var path = this.getPathObjects(req, {account: true, db: true});
	if (path.error) {
		sendError(req, res, path.error, 404);
		return;
	}

	this.access.authRequest('getDatabaseFile', req, path, function(err, auth) {
		if (err) {
			sendError(req, res, err, 400);
			return;
		}
		if (auth.error) {
			sendError(req, res, auth.error, 401);
			return;
		}
	
		res.sendFile(path.db.dbFile, function(err) {
			if (err) {
				sendError(req, res, err);
				return;
			}
			log.info({req: req}, '...Controller.getDatabaseFile().');
		});

	});	
}

Controller.prototype.requestNonce = function(req, res) {
	log.info({req: req}, 'Controller.requestNonce()...');

	var me = this;
	var path = this.getPathObjects(req, {account: true, db: true});
	if (path.error) {
		sendError(req, res, path.error, 404);
		return;
	}

	this.access.authRequest('requestNonce', req, path, function(err, auth) {

		if (err) {
			sendError(req, res, err, 400);
			return;
		}
		if (auth.error) {
			sendError(req, res, auth.error, 401);
			return;
		}

		var op = undefined;
		if (req.body.path) {
			if (req.body.path.match(/^\/(\w+)\/(\w+)\.sqlite$/)) {
				op = 'getDatabaseFile';
			}
		}

		if (! op) {
			sendError(req, res, new Error('Invalid or missing path argument.'), 400);
			return;
		}

		me.access.createNonce(op, function(err, nonce) {
			
			if (err) {
				sendError(req, res, err);
				return;
			}

			res.send({ nonce: nonce }); 
			log.info({req: req}, '...Controller.requestNonce().');

		});

	});	
}


Controller.prototype.parseQueryParameters = function(req) {
	var params = {};
	_.each(req.query, function(v, k) {
		if (k[0] == '$') {
			var param = parser.parse(k + "=" + v);	
			params[param.name] = param.value;
		} else {
			params[k] = v;
		}
	});
	log.trace({params: params});
	return params;
}

Controller.prototype.nextUrl = function(req, offset) {
	var urlObj = url.parse(req.url, true);
	urlObj.search = undefined;
	urlObj.query['$skip'] = offset;
	return url.format(urlObj)
}

Controller.prototype.getRows = function(req, res, opts) {
	log.info({req: req}, 'Controller.getRows()...');
	//console.dir(req);
	var me = this;
	opts = opts || { obj: false };	

	var path = this.getPathObjects(req, {account: true, db: true, table: true});
	if (path.error) {
		sendError(req, res, path.error, 404);
		return;
	}

	this.access.authRequest('getRows', req, path, function(err, auth) {
		if (err) {
			sendError(req, res, err, 400);
			return;
		}
		if (auth.error) {
			sendError(req, res, auth.error, 401);
			return;
		}
	
		var params = me.parseQueryParameters(req);

		var q = { filter: params['$filter'], fields: params['$select'] };
		var auth2 = me.access.filterQuery(path, q, req.user);
		if (auth2.error) {
			sendError(req, res, auth2.error, 401);
			return;
		}

		path.db.all(path.table.name, {
				filter: auth2.filter 
				, fields: params['$select'] 
				, order: params['$orderby'] 
				, limit: params['$top'] 
				, offset: params['$skip'] 
				, debug: params['debug']	
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
				log.info({req: req}, '...Controller.getRows().');
			}
		);
	});
}

Controller.prototype.getObjs = function(req, res, opts) {
	log.info({req: req}, 'Controller.getObjs()...');
	var me = this;

	var path = this.getPathObjects(req, {account: true, db: true, table: true});
	if (path.error) {
		sendError(req, res, path.error, 404);
		return;
	}

	this.access.authRequest('getObjs', req, path, function(err, auth) {
		if (err) {
			sendError(req, res, err, 400);
			return;
		}
		if (auth.error) {
			sendError(req, res, auth.error, 401);
			return;
		}

		var params = me.parseQueryParameters(req);

		var q = { filter: params['$filter'], fields: params['$select'] };
		var auth2 = me.access.filterQuery(path, q, req.user);
		if (auth2.error) {
			sendError(req, res, auth2.error, 401);
			return;
		}

		//TODO make sure fields include path table id

		var orderObj = { field: 'id', order: 'asc' };
		var orderBy = [ orderObj ];
		
		if (params['$orderby']) orderBy.concat(params['$orderby']);

		path.db.all(path.table.name, {
				filter: auth2.filter 
				, fields: params['$select'] 
				, order: orderBy 
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
	
				//remove rows of probably incomplete last object
				if (result.nextOffset) {
					var i = result.rows.length - 1;
					var lastId = result.rows[i].id;
					var lastOffset = params['$skip'] ? params['$skip'] : 0;
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
				var objs = path.db.schema.graph
							.rowsToObj(result.rows, path.table.name);
				result.objs = objs;
				delete(result.rows);
	
				log.trace(result);
				res.send(result); 
				log.info({req: req}, '...Controller.getObjs().');
			}
		);
	});
}

Controller.prototype.getStats = function(req, res) {
	log.info({req: req}, 'Controller.getStats()...');
	var me = this;

	var path = this.getPathObjects(req, {account: true, db: true, table: true});
	if (path.error) {
		sendError(req, res, path.error, 404);
		return;
	}

	this.access.authRequest('getStats', req, path, function(err, auth) {
		if (err) {
			sendError(req, res, err, 400);
			return;
		}

		if (auth.error) {
			sendError(req, res, auth.error, 401);
			return;
		}
	
		var params = me.parseQueryParameters(req);

		//TODO add access control filter
	
		path.db.getStats(path.table.name, { 
				filter: params['$filter'], 
				fields: params['$select'] 
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
	});
}


Controller.prototype.stripOwnerField = function(rows) {
	return _.map(rows, function(row) {
		return _.omit(row, 'own_by');
	});
}

//insert rows into table
Controller.prototype.postRows = function(req, res) {
	var me = this;
	log.info({req: req}, 'Controller.postRows()...');
	log.debug({'req.body': req.body});

	var path = this.getPathObjects(req, {account: true, db: true, table: true});
	if (path.error) {
		sendError(req, res, path.error, 404);
		return;
	}

	this.access.authRequest('postRows', req, path, function(err, auth) {
	    
		if (err) {
			sendError(req, res, err, 400);
			return;
		}

		if (auth.error) {
			sendError(req, res, auth.error, 401);
			return;
		}
	
		var rows = req.body;
		var opts = req.query;
		opts.user = req.user;
	

/*
		if (opts.user.role == Schema.USER_ROLES.READER
		 || opts.user.role == Schema.USER_ROLES.WRITER) {
			me.stripOwnerField(rows);
		}
*/
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
	});
}

//update rows in table
Controller.prototype.putRows = function(req, res) {
	var me = this;
	log.info({req: req}, 'Controller.putRows()...');
	log.debug({'req.body': req.body});

	var path = this.getPathObjects(req, {account: true, db: true, table: true});
	if (path.error) {
		sendError(req, res, path.error, 404);
		return;
	}

	this.access.authRequest('putRows', req, path, function(err, auth) {
	    
		if (err) {
			sendError(req, res, err, 400);
			return;
		}
		
		if (auth.error) {
			sendError(req, res, auth.error, 401);
			return;
		}
	
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

	this.access.authRequest('delRows', req, path, function(err, auth) {
		if (err) {
			sendError(req, res, err, 400);
			return;
		}
	
		if (auth.error) {
			sendError(req, res, auth.error, 401);
			return;
		}
	
		var rowIds = req.body;
		path.db.delete(path.table.name, rowIds, function(err, result) {
			if (err) {
				sendError(req, res, err, 400);
				return;
			}
			res.send(result); 
			log.info({req: req}, '...Controller.delRows().');
		});
	});
}

//chown (change owner) of rows. deep, includes rows from all descendant tables
Controller.prototype.chownRows = function(req, res) {
	log.info({req: req}, 'Controller.chownRows()...');
	log.debug({'req.body': req.body});

	var path = this.getPathObjects(req, {account: true, db: true, table: true});
	if (path.error) {
		sendError(req, res, path.error, 404);
		return;
	}

	this.access.authRequest('chownRows', req, path, function(err, auth) {
		var owner = req.query.owner;
		if ( ! owner) {
			err = err || new Error('missing owner query parameter');
		}

		if (err) {
			sendError(req, res, err, 400);
			return;
		}
	
		if (auth.error) {
			sendError(req, res, auth.error, 401);
			return;
		}
	
		var rowIds = req.body;
		path.db.chown(path.table.name, rowIds, owner, function(err, result) {
			if (err) {
				sendError(req, res, err, 400);
				return;
			}
			res.send(result); 
			log.info({req: req}, '...Controller.chownRows().');
		});
	});
}
Controller.prototype.account = function(name) {
	return this.accountManager.get(name);
}

Controller.prototype.getPathObjects = function(req, objs) {

	log.trace({params: req.params}, 'Controller.getPathObjects...');

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

	log.trace({result: result}, '...Controller.getPathObjects');
	return result;
}

exports.ApiController = Controller;

