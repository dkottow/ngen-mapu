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
var crypto = require('crypto');
var config = require('config');

var Schema = require('./Schema.js').Schema;
var Table = require('./Table.js').Table;

var log = require('./log.js').log;

var tempDir = config.get('tempDir');
if ( ! path.isAbsolute(tempDir)) tempDir = path.join(process.cwd(), tempDir);

function AccessControl(options) {
	options = options || {};
	this.auth = options.auth || false;
}

AccessControl.prototype.getNoncePath = function(nonce) {
	var nonceDir = tempDir;
	return path.join(nonceDir, nonce + ".nonce");
}

AccessControl.prototype.supportsNonce = function(op)
{
	var nonceMethods = [ 
		'generateDatabaseFile', 
		'getDatabaseFile',
		'generateCSVFile', 
		'getCSVFile' 
	];
	return _.contains(nonceMethods, op);
}

AccessControl.prototype.checkNonce = function(nonce, cbResult) {
	fs.unlink(this.getNoncePath(nonce), function(err) {
		if (err) {
			log.error({ err: err, nonce: nonce }, 'AccessControl.checkNonce');
			cbResult(err, false);
		} else {
			cbResult(null, true);
		}
	});
}

AccessControl.prototype.createNonce = function(op, cbResult) {
	if (this.supportsNonce(op)) {
		var nonce = crypto.randomBytes(48).toString('hex');

		var path = this.getNoncePath(nonce);
		fs.open(path, "w", function (err, fd) {
		    if (err) {
		    	cbResult(err, null);
		    } else {
			    fs.close(fd, function (err) {
			        cbResult(err, nonce);
			    });
		    }
		});

	} else {
		cbResult(new Error('Method does not support nonce'), null);
	}
}


AccessControl.prototype.authRequest = function(op, req, path, cbResult) {
	log.debug({ op: op}, 'AccessControl.authRequest()...'); 
	log.trace({ 'req.user': req.user, path: path }, 'AccessControl.authRequest()'); 

	var resultFn = function(result) {
		if ( ! result.granted) {
			result.error = new Error(result.message);
		}
		log.debug({ result: result }, '...AccessControl.authRequest()');
		cbResult(null, result);
	};

	//auth disabled
	if ( ! this.auth) {
		resultFn({ granted: true, message:  'auth disabled'});
		return;
	}

	//sys admin - return true
	if (req.user.root) {
		resultFn({ granted: true, message:  'system admin'});
		return;
	}

	//is it a nonce operation?
	if (req.query && req.query.nonce) {
		
		if (this.supportsNonce(op)) {
			this.checkNonce(req.query.nonce, function(err, validNonce) {
				var msg = err ? 'invalid nonce' : 'valid nonce';
				resultFn({ granted: validNonce, message: msg });
			});
		} else {
			resultFn({ granted: false, message: 'op does not support nonce' });
		}
		return;
	}

	//if path has no account its a global op and requires system admin - return false
	if ( ! (path && path.account)) {
		resultFn({ granted: false, message: 'requires system admin'});
		return;
	}

	//user account mismatch - return false
	if (req.user.account != path.account.name) {
		log.trace({ 
            "user.account": req.user.account,
            "path.account": path.account.name
		} , 'Controller.authorized()');
		resultFn({ granted: false, message: 'user - account mismatch'});
		return;
	}

	//user is account admin - return true
	if (req.user.admin) {
		resultFn({ granted: true, message: 'account admin'});
		return;
	}

	if (op == 'getAccount') {
		resultFn({ granted: true });
		return;
	}

	//path has no db aka op requires account admin - false
	if ( ! path.db) {
		resultFn({ granted: false, message: 'requires account admin'});
		return;
	}

	log.trace({
			"db.name": path.db.name(), 
			"db.users": path.db.users() 
		}, 'AccessControl.authRequest()');

	var dbUser = path.db.user(req.user.name);

	//user is no db user - false
	if ( ! dbUser) {
		resultFn({ granted: false, message: 'user - db user mismatch'});
		return;
	}

	_.extend(req.user, dbUser);

	//user is db owner - true
	if (dbUser.role == Schema.USER_ROLES.OWNER) {
		resultFn({ granted: true, message: 'db owner'});
		return;
	}
			
	//user is either db reader / writer. most ops depend on table access control now..
	switch(op) {

		case 'getAccount':			
		case 'getDatabase':			
		case 'getViewRows':			
			resultFn({ granted: true });
			return;

		case 'getRows':			
		case 'getObjs':			
		case 'getStats':
		case 'generateCSVFile':			
			var table_access = path.table.access(req.user);
			var result = { 
				granted: table_access.read != Table.ROW_SCOPES.NONE
				, message: 'Table read access is none.'
			} 
			resultFn(result);
			return;
			
		case 'postRows':			
			var table_access = path.table.access(req.user);
			var result = { 
				granted: table_access.write != Table.ROW_SCOPES.NONE
				, message: 'Table write access is none.'
			} 
			resultFn(result);
			return;

		case 'putRows':			
		case 'delRows':
			var table_access = path.table.access(req.user);
			if (table_access.write == Table.ROW_SCOPES.OWN) {
				//check if rows affected are owned by callee 
				var rowIds = op == 'delRows' ? req.body : _.pluck(req.body, 'id');
				var owned = path.db.rowsOwned(path.table.name, rowIds, req.user, 
					function(err, owned) {
						if (err) {
							cbResult(err, null);
							return;
						} 
						var result = {
							granted: owned,
							message: 'Table write access is own.'
						}
						resultFn(result);
					});
			} else {
				var result = { 
					granted: table_access.write != Table.ROW_SCOPES.NONE
					, message: 'Table write access is none.'
				} 
				resultFn(result);
			}
			return;						
						
		case 'putDatabase':			
		case 'patchDatabase':			
		case 'delDatabase':			
		case 'generateDatabaseFile':			
		case 'chownRows':			
			resultFn({ granted: false, message: 'requires db owner'});
			return;
			
		default:
			resultFn({ granted: false, message: 'unknown op'});
	}
}

AccessControl.prototype.filterQuery = function(path, query, user) {
	log.trace('AccessControl.filterQuery()...'); 
	log.trace({ query: query, user: user }, 'AccessControl.filterQuery()...'); 

	if ( ! this.auth) return { filter: query.filter };

	var fields = query.fields || Table.ALL_FIELDS;
	var queryFields = path.db.sqlBuilder.sanitizeFieldClauses(path.table, fields);
	var queryTables = _.uniq(_.pluck(queryFields, 'table'));

	var acFilters = [];
	for(var i = 0;i < queryTables.length; ++i) {

		var table = path.db.table(queryTables[i]);
		var access = table.access(user);

		if (access.read == Table.ROW_SCOPES.ALL) {
			; //pass through
			
		} else if (access.read == Table.ROW_SCOPES.OWN) {
			acFilters.push({
				table: table.name
				, field: 'own_by'
				, op: 'eq'
				, value: user.name
			});		
			
		} else { //access.read == Table.ROW_SCOPES.NONE
			var msg = 'Table read access is none';
			log.info({ table: table.name, access: access }, msg + ' AccessControl.filterQuery()'); 
			return {
				error: new Error(msg),
				filter: []
			};			
		}
	}
	
	var queryFilter = query.filter || [];
	var result = {
		filter: queryFilter.concat(acFilters),
		error: null
	};
	
	log.trace({ result: result }, '...AccessControl.filterQuery()'); 
	return result;
	
}

AccessControl.prototype.filterDatabases = function(path, databases, user) {
	log.trace({ user: user }, 'AccessControl.filterDatabases()...'); 
	log.trace({ databases: databases }, 'AccessControl.filterDatabases()');

	if ( ! this.auth) return databases;
	if (user.admin) return databases;
	
	var result =  _.filter(databases, function(db) {
		return _.find(db.users, function(dbUser) {
			return dbUser.name == user.name;
		});
	});
	result = _.object(_.pluck(result, 'name'), result);
	log.trace({ result: result }, '...AccessControl.filterDatabases()'); 
	return result;
}

AccessControl.prototype.filterTables = function(path, tables, user) {
	log.trace('AccessControl.filterTables()...'); 
	log.trace({ user: user, tables: tables }, 'AccessControl.filterTables()');

	if ( ! this.auth) return tables;
	//if (user.admin || user.role == Schema.USER_ROLES.OWNER) return tables;
	
	var result =  _.filter(tables, function(t) {
		var access = path.db.table(t.name).access(user);
		return access.read != Table.ROW_SCOPES.NONE;
	});
	result = _.object(_.pluck(result, 'name'), result);

	log.trace({ result: result }, '...AccessControl.filterTables()'); 
	log.trace('...AccessControl.filterTables()'); 
	return result;
}

AccessControl.prototype.getCSVFilename = function(nonce) {
	return path.join(tempDir, nonce + ".csv");
}


exports.AccessControl = AccessControl;

