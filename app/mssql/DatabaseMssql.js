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


//var sqlite3 = require('sqlite3');
var mssql = require('mssql');
var _ = require('underscore');

var fs = require('fs');
var path = require('path');
var util = require('util');

var Schema = require('../Schema.js').Schema;
var SchemaChange = require('../SchemaChange.js').SchemaChange;
var Database = require('../Database.js').Database;
var Field = require('../Field.js').Field;
var Table = require('../Table.js').Table;

var SqlBuilder = require('./SqlBuilderMssql.js').SqlBuilderMssql;

var log = require('../log.js').log;


var DatabaseMssql = function(config) 
{
	log.trace('new Database ' + config.database);

	Database.call(this);
}

DatabaseMssql.prototype = Object.create(Database.prototype);	

DatabaseMssql.prototype.writeSchema = function(cbAfter) {
	var me = this;
	try {

		var opts = { exclude: { viewSQL: true, searchSQL: true }};
		var createSQL = this.sqlBuilder.createSQL(this.schema, opts);

		var viewSQLs = _.map(this.schema.tables(), function(table) {
			return this.createRowAliasViewSQL(table); 	
		}, this);

		mssql.connect(this.config, function(err) {
			if (err) {
				cbAfter(err);
				return;
			}

						
		});

	} catch(err) {
		log.error({err: err}, "Database.writeSchema() exception.");
		cbAfter(err);
	}
}


exports.DatabaseMssql = DatabaseMssql;
