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

var Schema = require('./Schema.js').Schema;
var Table = require('./Table.js').Table;

var log = global.log.child({'mod': 'g6.AccessControl.js'});


function AccessControl() {
}


AccessControl.prototype.authRequest = function(op, req, path, cbResult) {
	log.debug({ op: op, 'req.user': req.user }, 'AccessControl.authRequest()...'); 
	log.trace({ path: path }, 'AccessControl.authRequest()'); 

	var resultFn = function(result) {
		if ( ! result.granted) {
			result.error = new Error(result.message);
		}
		log.debug({ result: result }, '...AccessControl.authRequest()');
		cbResult(null, result);
	};

	//auth disabled
	if ( ! global.auth) {
		resultFn({ granted: true, message:  'auth disabled'});
		return;
	}

	//sys admin - true
	if (req.user.root) {
		resultFn({ granted: true, message:  'system admin'});
		return;
	}

	//path has no account aka global op requires system admin - false
	if ( ! (path && path.account)) {
		resultFn({ granted: false, message: 'requires system admin'});
		return;
	}

	//user account mismatch - false
	if (req.user.account != path.account.name) {
		log.debug({ 
            "user.account": req.user.account,
            "path.account": path.account.name
		} , 'Controller.authorized()');
		resultFn({ granted: false, message: 'user - account mismatch'});
		return;
	}

	//user is account admin - true
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

	log.debug({
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
		case 'getRows':			
		case 'getStats':
			resultFn({ granted: true });
			return;
			
		case 'postRows':			
			var table_access = path.table.access(req.user);
			var result = { 
				granted: 
					table_access.write == Table.ROW_SCOPES.ALL
				 || table_access.write == Table.ROW_SCOPES.OWN
				, message: 'Table write access is none.'
			} 
			resultFn(result);
			return;

		case 'putRows':			
		case 'delRows':
			var owned = path.db.rowsOwned(path.table.name, req.body, req.user, 
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
			return;
						
		case 'putDatabase':			
		case 'patchDatabase':			
		case 'delDatabase':			
			resultFn({ granted: false, message: 'requires db owner'});
			return;
			
		default:
			resultFn({ granted: false, message: 'unknown op'});
	}
}

exports.AccessControl = AccessControl;

