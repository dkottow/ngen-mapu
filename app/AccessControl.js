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
var User = require('./User.js').User;

var log = require('./log.js').log;

var tempDir = config.get('tempDir');
if ( ! path.isAbsolute(tempDir)) tempDir = path.join(process.cwd(), tempDir);

function AccessControl(options) {
	options = options || {};
	this.auth = options.auth || false;
}

AccessControl.prototype.authRequest = function(op, req, path) {
	log.debug({ op: op, user: req.user ? req.user.name() : '' }, 'AccessControl.authRequest()...'); 

	var resolveFn = function(msg) {
		log.debug({msg: msg}, '...AccessControl.authRequest');
		return Promise.resolve(true);
	}

	var rejectFn = function(msg) {
		var err = new Error(msg);
		err.code = 401;
		log.debug({err: err}, '...AccessControl.authRequest');
		return Promise.reject(err);
	}
	
	//auth disabled
	if ( ! this.auth) {
		return resolveFn('auth disabled');
	}

	//is it a nonce operation?
	if (req.query && req.query.nonce) {
		
		if (this.supportsNonce(op)) {
			return this.checkNonce(req.query.nonce).then(() => { 
				return resolveFn('valid nonce');
			});
		} else {
			return rejectFn('op does not support nonce');
		}
	}

	if ( ! req.user) {
		return rejectFn('op requires authenticated user');
	}

//TODO remove me after pilot	
if (req.user.name() == User.NOBODY) {
	log.debug('AccessControl.authRequest() temporary passthrough'); 
	return resolveFn('User.NOBODY enabled temporary');
}

	var scope = {
		account: path.account ? path.account.name : null,
		database: path.db ? path.db.name() : null,
		table: path.table ? path.table.name : null
	}

	log.debug({scope: scope}, 'AccessControl.authRequest()')

	return req.user.isAdmin(scope).then((isAdmin) => {

//return Promise.reject(new Error('this error does not work'));
//return new Promise(function(resolve, reject) { reject(new Error('this error does not work')); });

		if (isAdmin) {
			return resolveFn('user is admin');
			
		} else if (! path.db) {
			return rejectFn('scope requires admin user');

		} else {
			return req.user.access(path.db, scope);
		}
		
	}).then((access) => {
		if (access === true) return Promise.resolve(true); //user is admin

		//normal user access depends on op.
		switch(op) {

			case 'getDatabase':			
			case 'getViewRows':			
				var granted = access.Read != Table.ROW_SCOPES.NONE;
				if (granted) {
					return resolveFn('user has ' + access.Read + ' access to ' + scope.database);
				} else {
					return rejectFn('Read access is none.');
				} 

			case 'getRows':			
			case 'getObjs':			
			case 'getStats':
			case 'generateCSVFile':			
				var granted = access.Read != Table.ROW_SCOPES.NONE;
				if (granted) {
					return resolveFn('user has ' + access.Read + ' read access to ' + scope.table);
				} else {
					return rejectFn('Table read access is none.');
				} 
				
			case 'postRows':			
				var granted = access.Write != Table.ROW_SCOPES.NONE;
				if (granted) {
					return resolveFn('user has ' + access.Write + ' write access to ' + scope.table);
				} else {
					return rejectFn('Table write access is none.');
				} 

			case 'putRows':			
			case 'delRows':
				if (access.Write == Table.ROW_SCOPES.OWN) {
					//check if rows affected are owned by callee 
					return new Promise(function(resolve, reject) {
						var rowIds = op == 'delRows' ? req.body : _.pluck(req.body, 'id');
						var owned = path.db.rowsOwned(path.table.name, rowIds, req.user.principal(), 
							function(err, owned) {
								if (err) {
									log.warn({err: err}, '...AccessControl.authRequest');
									return reject(err);
								} 
								if ( ! owned) {
									var err = new Error('Table write access is own.');
									log.warn({err: err}, '...AccessControl.authRequest');
									return reject(err);
								}
								var msg = 'user has ' + access.Write + ' write access to ' + scope.table;
								log.debug({msg: msg}, '...AccessControl.authRequest');
								return resolve(true);
							});
						});
				} else {
					var granted = access.Write != Table.ROW_SCOPES.NONE;
					if (granted) {
						return resolveFn('user has ' + access.Write + ' write access to ' + scope.table);
					} else {
						return rejectFn('Table write access is none.');
					} 
				}
				return;						
							
			case 'putDatabase':			
			case 'patchDatabase':			
			case 'delDatabase':			
			case 'chownRows':			
				return rejectFn('op requires admin user.');
				
			default:
				return rejectFn('unknown op ' + op);
		}		
	});	
}

AccessControl.prototype.filterQuery = function(path, query, user) {
	log.debug({ 
		user: user.name(), 
		principal: user.principal() 
	}, 'AccessControl.filterQuery()...'); 

	if ( ! this.auth) return Promise.resolve(query.filter);

//TODO remove me after pilot	
if (user.name() == User.NOBODY) {
	log.debug('AccessControl.filterQuery() temporary passthrough'); 
	return Promise.resolve(query.filter);
}

	var scope = { account: path.account.name, database: path.db.name() };
	return user.isAdmin(scope).then((isAdmin) => {

		if (isAdmin) {
			log.debug({ isAdmin: isAdmin }, '...AccessControl.filterQuery().'); 	
			return Promise.resolve(query.filter);
		}

		var err = new Error();
		err.code = 401;
	
		var fields = query.fields || Table.ALL_FIELDS;
		var queryFields = path.db.sqlBuilder.sanitizeFieldClauses(path.table, fields);
		var queryTables = _.uniq(_.pluck(queryFields, 'table'));
		
		var promises = _.map(queryTables, function(name) {
			return user.access(path.db, { table: name });		
		});
	
		return Promise.all(promises).then(accessList => {
			log.debug({ access: accessList }, 'AccessControl.filterQuery()'); 	
	
			var denied = _.find(accessList, function(access) { return access.Read == Table.ROW_SCOPES.NONE; });
			if (denied) {
				err.message = 'Table read access is none';			
				return Promise.reject(err);
			} 
			var ownAccessList = _.filter(accessList, function(access) {
				return access.Read == Table.ROW_SCOPES.OWN;	
			});
	
			var queryFilter = query.filter || [];
			var acFilter = _.map(ownAccessList, function(access) {
				return {
					table: access.table
					, field: 'own_by'
					, op: 'in'
					, value: [ user.principal(), User.EVERYONE ]
				};					
			});
	
			return Promise.resolve(queryFilter.concat(acFilter));
		});
	});

}

AccessControl.prototype.getNoncePath = function(nonce) {
	var nonceDir = tempDir;
	return path.join(nonceDir, nonce + ".nonce");
}

AccessControl.prototype.supportsNonce = function(op) {
	var nonceMethods = [ 
		'generateCSVFile', 
		'getCSVFile' 
	];
	return _.contains(nonceMethods, op);
}

AccessControl.prototype.createNonce = function(op, cbResult) {
	var me = this;
	return new Promise(function(resolve, reject) {

		if (me.supportsNonce(op)) {
			var nonce = crypto.randomBytes(48).toString('hex');
			var path = me.getNoncePath(nonce);
			fs.open(path, "w", function (err, fd) {
				if (err) {
					reject(err);
				} else {
					fs.close(fd, function (err) {
						if (err) reject(err);
						else resolve(nonce);
					});
				}
			});
		} else {
			reject(new Error('Method does not support nonce'));
		}
	});	
}

AccessControl.prototype.checkNonce = function(nonce) {
	return new Promise(function(resolve, reject) {

		fs.unlink(this.getNoncePath(nonce), function(err) {
			if (err) {
				log.error({ err: err, nonce: nonce }, 'AccessControl.checkNonce');
				var err = new Error('invalid nonce');
				return reject(err);
			} else {
				return resolve(true);
			}
		});

	});
}

AccessControl.prototype.getCSVFilename = function(nonce) {
	return path.join(tempDir, nonce + ".csv");
}


exports.AccessControl = AccessControl;

