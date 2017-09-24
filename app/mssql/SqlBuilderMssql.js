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
var fs = require('fs');

var Field = require('../Field.js').Field;
var Table = require('../Table.js').Table;
var Schema = require('../Schema.js').Schema;

var SqlHelper = require('./SqlHelperMssql.js').SqlHelperMssql;
var SqlBuilder = require('../SqlBuilder.js').SqlBuilder;

var config = require('config');
var log = require('../log.js').log;

var SqlBuilderMssql = function(tableGraph) {
	SqlBuilder.call(this, tableGraph);
}

SqlBuilderMssql.prototype = Object.create(SqlBuilder.prototype);	


SqlBuilderMssql.prototype.joinTableSQL = function(fromTable, fields, filterClauses, fkGroups) {

	//collect filter and field tables
	var joinTables = _.pluck(filterClauses, 'table')
		.concat(_.pluck(fields, 'table'));

	//check for full-text search... there can be only one such filter
	var searchFilter = _.find(filterClauses, function(filter) {
		return filter.op == 'search' && filter.field == Table.ALL_FIELDS;
	});

	if (searchFilter && config.sql.fullTextSearch) {
		_.each(fromTable.foreignKeys(), function(fk) {
			var fk_table = this.graph.table(fk.fk_table);

			var rowAliasFields = this.rowAliasFields(fk_table);
			var searchTables = _.map(_.filter(rowAliasFields, function(f) {
				return f.typeName() == 'text';
			}), function(f) {
				return f.table.name;
			});	
			joinTables = joinTables.concat(searchTables);
		}, this);
	}
	var graphSQL = this.joinGraphSQL(fromTable.name, joinTables);

	return graphSQL;
}

SqlBuilderMssql.prototype.filterSearchSQL = function(filter) {

	if ( ! config.sql.fullTextSearch) return { clause: null, params: [] };

	var searchValue = '"' + filter.value + '*"';  

	var param = SqlHelper.param({
			name: filter.table + Table.TABLE_FIELD_SEPARATOR + '$earch', 
			value: searchValue,
			type: 'text'
		});
	
	var clauses = [];

	var table = this.graph.table(filter.table);
	_.each(table.foreignKeys(), function(fk) {
		var fk_table = this.graph.table(fk.fk_table);

		var rowAliasFields = this.rowAliasFields(fk_table);
		var fkClauses = _.map(_.filter(rowAliasFields, function(f) {
			return f.typeName() == 'text';
		}), function(f) {
			return util.format('CONTAINS(%s.%s, %s)', 
						f.table.name, SqlHelper.EncloseSQL(f.name), param.sql);
		});

		clauses = clauses.concat(fkClauses);

		log.trace({fk_table: fk_table.name, clauses: clauses });
	}, this);

	var tableClause = util.format('CONTAINS(%s.*, %s)', 
					filter.table, param.sql);
	clauses.push(tableClause);
	var clause = '(' + clauses.join(' OR ') + ')';

	return { clause: clause, params: [ param ] };
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

SqlBuilder.prototype._createStoredProcsSQLBatches = function() {

	return new Promise(function(resolve, reject) {

		var fn = path.join('app', 'mssql', SqlHelper.SP_ACCESS + '.sql'); 
		fs.readFile(fn, 'utf8', function(err, sql) {
			if (err) {
				reject(err);
			} else {
				resolve(sql);	
			}			
		});
	});
}

exports.SqlBuilderMssql = SqlBuilderMssql;

