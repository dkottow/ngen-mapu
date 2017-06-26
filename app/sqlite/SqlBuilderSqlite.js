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

var Field = require('../Field.js').Field;
var Table = require('../Table.js').Table;
var Schema = require('../Schema.js').Schema;

var SqlHelper = require('./SqlHelperSqlite.js').SqlHelperSqlite;
var SqlBuilder = require('../SqlBuilder.js').SqlBuilder;

var log = require('../log.js').log;

var SqlBuilderSqlite = function(tableGraph) {
	SqlBuilder.call(this, tableGraph);
}

SqlBuilderSqlite.prototype = Object.create(SqlBuilder.prototype);	

SqlBuilderSqlite.prototype.joinTableSQL = function(fromTable, fields, filterClauses, fkGroups) {

	//collect filter and field tables
	var joinTables = _.pluck(filterClauses, 'table')
		.concat(_.pluck(fields, 'table'));

	var graphSQL = this.joinGraphSQL(fromTable.name, joinTables);

	var result = {
		tables : graphSQL.tables,
		clauses : graphSQL.clauses
	};

	//check for full-text search... there can be only one such filter
	var searchFilter = _.find(filterClauses, function(filter) {
		return filter.op == 'search' && filter.field == Table.ALL_FIELDS;
	});

	if (searchFilter) {
		var table = this.graph.table(searchFilter.table);
		var clause = util.format('(%s.docid = %s.id)',
			table.ftsName(),
			table.name);

		result.tables.push(table.ftsName());
		result.clauses.push(clause);
	}

	return result;	
}

SqlBuilderSqlite.prototype.filterSearchSQL = function(filter) {
	var table = this.graph.table(filter.table);

	//(prefix last + phrase query) - see sqlite fts
	var searchValue = '"' + filter.value + '*"';  
	var param = SqlHelper.param({
			name: filter.table + Table.TABLE_FIELD_SEPARATOR + '$earch', 
			value: searchValue,
			type: 'text'
		});

	var clause = util.format('(%s.%s MATCH %s)', 
					table.ftsName(), table.ftsName(), param.sql); 	

	return { clause: clause, params: [ param ] };
}

SqlBuilderSqlite.prototype.dropDependenciesSQL = function(table) {
	return '';
}

SqlBuilderSqlite.prototype.addDependenciesSQL = function(table) {
	return '';
}


exports.SqlBuilderSqlite = SqlBuilderSqlite;

