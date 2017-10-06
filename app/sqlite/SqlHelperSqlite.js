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

var SqlHelperSqlite = {
	Field: {},
	Table: {},
	Schema: {}
}

var USER_EVERYONE = 'Everyone';
var USER_NOBODY = 'unknown';

SqlHelperSqlite.EncloseSQL = function(name) {
	return '[' + name + ']';
}

SqlHelperSqlite.ConcatSQL = function(values) {
	return values.join(' || '); //'"' + name + '"';
}

SqlHelperSqlite.OffsetLimitSQL = function(offset, limit) {
	return ' LIMIT ' + limit
		+ ' OFFSET ' + offset;
}

SqlHelperSqlite.param = function(attrs)
{
	return {
		name: attrs.name,
		value: attrs.value,
		type: attrs.type,
		sql: '?'
	};
}

SqlHelperSqlite.FileExtension = '.sqlite';

/********** Schema stuff *********/

SqlHelperSqlite.Schema.PragmaSQL = "PRAGMA journal_mode=WAL;\n\n";

/******** Table stuff ********/

SqlHelperSqlite.Table.createPrimaryKeySQL = function(name) {
	return "PRIMARY KEY (id)";
}

/* 

use triggers to populate FTS full text search
see https://github.com/coolaj86/sqlite-fts-demo

sqlite> create trigger <table>_ai after insert on <table> 
		begin    
			insert into fts_orders (docid,content) 
			select id as docid, <concat fields> AS content from <table> 
			where id = new.id; 
		end;
*/

SqlHelperSqlite.Table.hasTriggers = function() { return true; }

SqlHelperSqlite.Table.dropTriggerSQL = function(table) {
	var sql = 'DROP TRIGGER IF EXISTS tgr_' + table.name + '_ai;\n'
		+ 'DROP TRIGGER IF EXISTS tgr_' + table.name + '_bu;\n'
		+ 'DROP TRIGGER IF EXISTS tgr_' + table.name + '_au;\n'
		+ 'DROP TRIGGER IF EXISTS tgr_' + table.name + '_bd;\n\n';

	return sql;
}

SqlHelperSqlite.Table.createTriggerSQL = function(table) {

	//group foreign keys by referenced table to number referenced tables
	//e.g. vra_team as vra_team01, vra_team as vra_team02 etc.
	var fk_groups = _.groupBy(table.foreignKeys(), function(fk) {
		return fk.fk_table;
	});

	var fkSQL = _.map(table.foreignKeys(), function(fk) {
		return table.fkAliasSQL(fk, 
						fk_groups[fk.fk_table].indexOf(fk) + 1);
	});

	var rowAliasSQL = table.rowAliasSQL();

	var tables = [table.name, rowAliasSQL.table];
	var fkAlias = _.map(fkSQL, function(ref) {
		return util.format('%s AS %s', ref.table, ref.alias); 
	});

	tables = [table.name, rowAliasSQL.table].concat(fkAlias);

	var fieldContent = _.map(table.fields(), function(f) {
		return util.format("COALESCE(%s.%s, '')", table.name, SqlHelperSqlite.EncloseSQL(f.name));
	});

	var refCoalesceFn = function(t) {
		return util.format("COALESCE(%s.ref, '')", t);
	};

	fieldContent.push(refCoalesceFn(rowAliasSQL.table));

	_.each(fkSQL, function(fk) {
		fieldContent.push(refCoalesceFn(fk.alias));
	});

	var refClauses = _.pluck(fkSQL, 'clause');
	refClauses = [ rowAliasSQL.clause ].concat(refClauses);

	var tableId = table.name + '.id';

	var content = fieldContent.join(" || ' ' || ");	

	var sql = 'CREATE TRIGGER tgr_' + table.name + '_ai'
		+ ' AFTER INSERT ON ' + table.name
		+ ' BEGIN\n INSERT INTO ' + table.ftsName() + ' (docid, content) '
		+ ' SELECT ' + tableId + ' AS docid, ' + content + ' as content'
		+ ' FROM ' + tables.join(', ') 
		+ ' WHERE ' + tableId + ' = new.id'
		+ ' AND ' + refClauses.join(' AND ') + ';'
		+ '\nEND;\n\n';

	sql += 'CREATE TRIGGER tgr_' + table.name + '_bu '
		+ ' BEFORE UPDATE ON ' + table.name
		+ ' BEGIN\n DELETE FROM ' + table.ftsName() 
		+ ' WHERE docid = old.id;'
		+ '\nEND;\n\n';

	sql += 'CREATE TRIGGER tgr_' + table.name + '_au'
		+ ' AFTER UPDATE ON ' + table.name
		+ ' BEGIN\n INSERT INTO ' + table.ftsName() + ' (docid, content) '
		+ ' SELECT ' + tableId + ' AS docid, ' + content + ' as content'
		+ ' FROM ' + tables.join(', ') 
		+ ' WHERE ' + tableId + ' = new.id'
		+ ' AND ' + refClauses.join(' AND ') + ';'
		+ '\nEND;\n\n';

	sql += 'CREATE TRIGGER tgr_' + table.name + '_bd '
		+ ' BEFORE DELETE ON ' + table.name
		+ ' BEGIN\n DELETE FROM ' + table.ftsName() 
		+ ' WHERE docid = old.id;'
		+ '\nEND;\n\n';

	return sql;
}

SqlHelperSqlite.Table.createSearchSQL = function(table) {
	var createSQL = 'CREATE VIRTUAL TABLE ' + table.ftsName() 
			+ ' USING fts4(content, tokenize=simple "tokenchars=-");\n\n';
	var triggerSQL = SqlHelperSqlite.Table.createTriggerSQL(table);
	var sql = createSQL + triggerSQL;
	log.trace({ sql: sql }, 'Table.createSearchSQL()');
	return sql;
}

SqlHelperSqlite.Table.dropSearchSQL = function(table) {
	return 'DROP TABLE IF EXISTS ' + table.ftsName() + ';\n';
}

SqlHelperSqlite.Table.addForeignKeysSQL = function(table) {
	return ''; //no-op since it is not supported
}

SqlHelperSqlite.Table.dropForeignKeysSQL = function(table) {
	return ''; //no-op since it is not supported
}

/********** Field **********/

SqlHelperSqlite.Field.defaultSQL = function(field) {

	if (_.contains(['mod_on', 'add_on'], field.name)) {
		return "DEFAULT(datetime('now'))";

	} else if (_.contains(['mod_by', 'add_by'], field.name)) {
		return util.format("DEFAULT '%s'", USER_NOBODY);

	} else if ('own_by' == field.name) {
		return util.format("DEFAULT '%s'", USER_EVERYONE);

	} else {
		return '';
	}
}

SqlHelperSqlite.Field.typeSQL = function(fieldType)
{
	var typeName = SqlHelperSqlite.typeName(fieldType);
	
	if (typeName == 'text') return fieldType.replace(/^text/, 'VARCHAR');
	else if (typeName == 'integer') return 'INTEGER';
	else if (typeName == 'decimal') return fieldType.replace(/^decimal/, 'DECIMAL');
	else if (typeName == 'timestamp') return 'DATETIME';
	else if (typeName == 'date') return 'DATE'; 
	else if (typeName == 'float') return 'FLOAT'; 
	else throw new Error("SqlHelperSqlite unknown type '" + fieldType + "'");
}

SqlHelperSqlite.Field.fromSQLType = function(sqlType)
{
	if (sqlType.startsWith('VARCHAR')) return sqlType.replace(/^VARCHAR/, 'text');
	else if (sqlType == 'INTEGER') return 'integer';
	else if (sqlType.startsWith('DECIMAL')) return sqlType.replace(/^DECIMAL/, 'decimal');
	else if (sqlType.startsWith('NUMERIC')) return sqlType.replace(/^NUMERIC/, 'decimal'); //backward compat.
	else if (sqlType == 'DATETIME') return 'timestamp';
	else if (sqlType == 'DATE') return 'date'; 
	else if (sqlType == 'FLOAT') return 'float'; 
	else throw new Error("SqlHelperSqlite unknown type '" + sqlType + "'");	
}

SqlHelperSqlite.Field.foreignKeySQL = function(table, field)
{
	return field.fk 
		? util.format('REFERENCES %s(%s)', field.fk_table, field.fk_field)
		: '';
}

SqlHelperSqlite.Field.autoIncrementSQL = function() 
{
	return '';
}

SqlHelperSqlite.dateToStringSQL = function(fieldName)
{
	return fieldName;
}

SqlHelperSqlite.timestampToStringSQL = function(fieldName)
{
	return fieldName;
}

exports.SqlHelperSqlite = SqlHelperSqlite;

