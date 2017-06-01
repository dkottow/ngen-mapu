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

var SqlHelper = require('./SqlHelperMssql.js').SqlHelperMssql;
var SqlBuilder = require('../SqlBuilder.js').SqlBuilder;

var log = require('../log.js').log;

var SqlBuilderMssql = function(tableGraph) {
	SqlBuilder.call(this, tableGraph);
}

SqlBuilderMssql.prototype = Object.create(SqlBuilder.prototype);	


SqlBuilderMssql.prototype.joinSearchSQL = function(filterClauses) {
	//there can be only one search filter
	var searchFilter = _.find(filterClauses, function(filter) {
		return filter.op == 'search' && filter.field == Table.ALL_FIELDS;
	});

	if (searchFilter) {
		var table = this.graph.table(searchFilter.table);
		var clause = util.format('(%s.docid = %s.id)',
			table.ftsName(),
			table.name);

		var result = {
			tables: [],
			clauses: []
		};
		
		return result;

	} else {
		return { tables: [], clauses: [] };
	}
}

SqlBuilderMssql.prototype.dropDependenciesSQL = function(table) {
	var childTables = this.graph.childTables(table);
	var result = _.reduce(childTables, function(sql, child) {
		return SqlHelper.Table.dropForeignKeysSQL(child, table);
	}, '');
	return result;
}

SqlBuilderMssql.prototype.addDependenciesSQL = function(table) {
	var childTables = this.graph.childTables(table);
	var result = _.reduce(childTables, function(sql, child) {
		return SqlHelper.Table.addForeignKeysSQL(child, table);
	}, '');
	return result;
}

exports.SqlBuilderMssql = SqlBuilderMssql;

