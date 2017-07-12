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

/**** sqlite *****/

var sql_engine = config.sql.engine;

var SqlHelperFactory = {
    Base: {
    }
};

SqlHelperFactory.Base.typeName = function(fieldType) 
{
    var m = fieldType.match(/^[a-z]+/);
    if (m && m.length > 0) return m[0];
    return null;
}

SqlHelperFactory.Base.typeModifier = function(fieldType) 
{
    var m = fieldType.match(/\(([0-9]+)(?:,([0-9]+))?\)$/);
    if (m && m[1] && ! m[2]) return { length : m[1] };
    if (m && m[1] && m[2]) return { precision : m[1], scale : m[2] };
    return null;
}

SqlHelperFactory.create = function() {

	if (sql_engine == 'sqlite') {
      var SqlHelperSqlite = require('./sqlite/SqlHelperSqlite.js').SqlHelperSqlite;
      return _.extend(SqlHelperSqlite, SqlHelperFactory.Base);

	} else if (sql_engine == 'mssql') {
      var SqlHelperMssql = require('./mssql/SqlHelperMssql.js').SqlHelperMssql;
      return _.extend(SqlHelperMssql, SqlHelperFactory.Base);
	}

	throw new Error(util.format("unsupported sql engine '%s'", sql_engine));	
}

exports.SqlHelperFactory = SqlHelperFactory;

