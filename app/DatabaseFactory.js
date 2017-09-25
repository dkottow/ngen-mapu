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
var config = require('config');

var DatabaseFactory = {};

var sql_engine = config.sql.engine;

DatabaseFactory.create = function(dbConfig) {

	if (sql_engine == 'sqlite') {
            var DatabaseSqlite = require('./sqlite/DatabaseSqlite.js').DatabaseSqlite;
		return new DatabaseSqlite(dbConfig);

	} else if (sql_engine == 'mssql') {
            var DatabaseMssql = require('./mssql/DatabaseMssql.js').DatabaseMssql;
		return new DatabaseMssql(dbConfig);
	}

	throw new Error(util.format("unsupported sql engine '%s'", sql_engine));	
}

DatabaseFactory.getClass = function() {
	if (sql_engine == 'sqlite') {
            return require('./sqlite/DatabaseSqlite.js').DatabaseSqlite;

	} else if (sql_engine == 'mssql') {
            return require('./mssql/DatabaseMssql.js').DatabaseMssql;
	}

	throw new Error(util.format("unsupported sql engine '%s'", sql_engine));	
}

exports.DatabaseFactory = DatabaseFactory;

