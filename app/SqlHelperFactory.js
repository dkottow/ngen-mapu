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

/**** sqlite *****/


global.sql_engine = global.sql_engine || 'sqlite';

var SqlHelperFactory = {};

SqlHelperFactory.create = function() {

	if (global.sql_engine == 'sqlite') {
      var SqlHelperSqlite = require('./sqlite/SqlHelperSqlite.js').SqlHelperSqlite;
		return SqlHelperSqlite;

	} else if (global.sql_engine == 'mssql') {
      var SqlHelperMssql = require('./mssql/SqlHelperMssql.js').SqlHelperMssql;
		return SqlHelperMssql;
	}

	throw new Error(util.format("unsupported sql engine '%s'", global.sql_engine));	
}

exports.SqlHelperFactory = SqlHelperFactory;

