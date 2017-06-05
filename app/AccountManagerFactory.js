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
var path = require('path');
var config = require('config');

var log = require('./log.js').log;

var sql_engine = config.sql.engine;

var AccountManagerFactory = {};

AccountManagerFactory.create = function(config) {

	if (sql_engine == 'sqlite') {
		var AccountManagerSqlite = require('./sqlite/AccountManagerSqlite.js').AccountManagerSqlite;
		return new AccountManagerSqlite(config);
	} else if (sql_engine == 'mssql') {
        var AccountManagerMssql = require('./mssql/AccountManagerMssql.js').AccountManagerMssql;
        return new AccountManagerMssql(config);
	}

	throw new Error(util.format("unsupported sql engine '%s'", sql_engine));	
}

exports.AccountManagerFactory = AccountManagerFactory;

