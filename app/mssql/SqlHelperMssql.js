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
var assert = require('assert');

var log = require('../log.js').log;

var SqlHelperMssql = {
	Field: {},
	Table: {},
	Schema: {}
}

var mssql = require('mssql');

SqlHelperMssql.EncloseSQL = function(name) {
	return '[' + name + ']';
}

SqlHelperMssql.ConcatSQL = function(values) {
	return values.join(' + '); 
}

SqlHelperMssql.OffsetLimitSQL = function(offset, limit) {
	return ' OFFSET ' + offset + ' ROWS' 
		+ ' FETCH NEXT ' + limit + ' ROWS ONLY';
}

SqlHelperMssql.param = function(attrs)
{
	return { 
		name: attrs.name, 
		value: attrs.value, 
		type: attrs.type,
		sql: '@' + attrs.name
	};
}

SqlHelperMssql.addInputParams = function(req, params)
{
	_.each(params, function(param) {
//console.log(param.name, SqlHelperMssql.mssqlType(param.type), param.value);
		req.input(param.name, SqlHelperMssql.mssqlType(param.type), param.value);
	});	
}

SqlHelperMssql.mssqlType = function(fieldType)
{
	if (fieldType == 'text') return mssql.NVarChar;
	else if (fieldType == 'integer') return mssql.Int;
	else if (fieldType == 'numeric') return mssql.Real;
	else if (fieldType == 'datetime') return mssql.VarChar(256); //TODO - use real js dates?
	else if (fieldType == 'date') return mssql.VarChar(256); //TODO - use real js dates?
	else throw new Error("unknown type '" + fieldType + "'");
}

/********** Schema stuff *********/

SqlHelperMssql.Schema.PragmaSQL = '';

SqlHelperMssql.Schema.fullName = function(account, db) {
	return account + '#' + db;
}

SqlHelperMssql.Schema.createPropsTableSQL = function(name) {
	return "CREATE TABLE " + name + " ("
		+ " name VARCHAR(256) NOT NULL, "
		+ "	value VARCHAR(MAX), "
		+ "	PRIMARY KEY (name) "
		+ ");\n\n"
}

SqlHelperMssql.Schema.dropSQL = function(dbName) {
	return util.format("IF EXISTS(select * from sys.databases where name='%s')\n"
			+ 'BEGIN\n'
			+ '  ALTER DATABASE [%s] SET SINGLE_USER WITH ROLLBACK IMMEDIATE\n'
			+ '  DROP DATABASE [%s]\n'
			+ 'END\n\n', dbName, dbName, dbName);
}


/******** Table stuff ********/

SqlHelperMssql.Table.createPropsTableSQL = function(name) {
	return "CREATE TABLE " + name + " ("
		+ " name VARCHAR(256) NOT NULL, "
		+ "	props VARCHAR(MAX), "
		+ " disabled INTEGER DEFAULT 0, "
		+ "	PRIMARY KEY (name) "
		+ ");\n\n";
}

SqlHelperMssql.Table.hasTriggers = function() { return false; }

/*** TODO see here
https://docs.microsoft.com/en-us/sql/t-sql/statements/create-fulltext-index-transact-sql
****/

SqlHelperMssql.Table.createSearchSQL = function(table) {
	return '';
}

SqlHelperMssql.Table.dropSearchSQL = function(table) {
	return '';
}

/********** Field **********/

SqlHelperMssql.Field.createPropsTableSQL = function(name) {
	return " CREATE TABLE " + name + " ("
		+ ' table_name VARCHAR(256) NOT NULL, '
		+ ' name VARCHAR(256) NOT NULL, '
		+ ' props VARCHAR(MAX), '
		+ ' disabled INTEGER DEFAULT 0, '
		+ ' PRIMARY KEY (name, table_name) '
		+ ");\n\n";
}
		
SqlHelperMssql.Field.defaultSQL = function(field) {

	if (_.contains(['mod_on', 'add_on'], field.name)) {
		return "DEFAULT GETDATE()";

	} else if (_.contains(['mod_by', 'add_by'], field.name)) {
		return "DEFAULT 'sql'";

	} else {
		return '';
	}
}

SqlHelperMssql.Field.typeSQL = function(type)
{
	if (type == 'VARCHAR') return 'NVARCHAR(4000)';
	if (type == 'NUMERIC') return 'NUMERIC(18,3)';
	type = type.replace(/VARCHAR(\([0-9]+\))/,'NVARCHAR$1');

	return type;
}

SqlHelperMssql.Field.autoIncrementSQL = function() 
{
	return 'IDENTITY(1,1)';
}


exports.SqlHelperMssql = SqlHelperMssql;

