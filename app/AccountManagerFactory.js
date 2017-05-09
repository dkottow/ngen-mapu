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
var log = require('./log.js').log;

var path = require('path');

var AccountManagerSqlite = require('./sqlite/AccountManagerSqlite.js').AccountManagerSqlite;

global.sql_engine = global.sql_engine || 'sqlite';


if (global.sql_engine == 'sqlite') {

	global.sqlite_ext = global.sqlite_ext || '.sqlite';
	
	var data_dir = path.join(process.cwd(), 'data');
	var tmp_dir = path.join(process.cwd(), 'tmp');
	
	if (process.env.OPENSHIFT_DATA_DIR) {
		tmp_dir = path.join(process.env.OPENSHIFT_DATA_DIR, 'tmp');
		data_dir = path.join(process.env.OPENSHIFT_DATA_DIR, 'data');
	}
	
	global.tmp_dir = global.tmp_dir || tmp_dir;
	global.data_dir = global.data_dir || data_dir;

} else if (global.sql_engine == 'mssql') {
	
	global.mssql_config = {
		user: 'dl_user',
		password: 'dl_pass',
		server: 'localhost\\HOLEBASE_SI'
	};
	
}

var AccountManagerFactory = {};

AccountManagerFactory.create = function() {
	if (global.sql_engine == 'sqlite') {
		return new AccountManagerSqlite();
	}
	throw new Error(util.format("unsupported sql engine '%s'", global.sql_engine));	
}

exports.AccountManagerFactory = AccountManagerFactory;

