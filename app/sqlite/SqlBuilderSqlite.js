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

SqlBuilderSqlite.prototype.createTableSQL = function(table) {
	return table.createSQL()
		+ this.createRowAliasViewSQL(table)
		+ SqlHelper.Table.createSearchSQL(table);
}

SqlBuilderSqlite.prototype.createSQL = function(schema) {

	var createSysTablesSQL = SqlHelper.Schema.PragmaSQL
			+ SqlHelper.Schema.createPropsTableSQL(Schema.TABLE)
			+ SqlHelper.Table.createPropsTableSQL(Table.TABLE)
			+ SqlHelper.Field.createPropsTableSQL(Field.TABLE);

	var sysTablesInsertSQL = schema.insertPropSQL({deep: true}); 

	var tables = this.graph.tablesByDependencies();

	var createTableSQL = _.map(tables, function(t) {
		return t.createSQL();
	}).join('\n');

	var createRowAliasViewSQL = _.map(tables, function(t) {
		var viewSQL = this.createRowAliasViewSQL(t);
		//log.debug(viewSQL);
		return viewSQL;
	}, this).join('\n');

	var createSearchSQL = _.map(tables, function(t) {
		return SqlHelper.Table.createSearchSQL(t);
	}).join('\n');

	var sql = createSysTablesSQL + '\n\n'
			+ sysTablesInsertSQL + '\n\n'
			+ createTableSQL + '\n\n'
			+ createRowAliasViewSQL + '\n\n'
			+ createSearchSQL + '\n\n';
	
	log.debug({sql: sql}, 'SqlBuilder.createSQL');
	return sql;
}

SqlBuilderSqlite.prototype.createRowAliasViewSQL = function(table) {

	var ref_tables = _.map(_.filter(table.row_alias, function(ref) {
			return ref.indexOf('.') >= 0;		
		}), function(ref) {
		return ref.split('.')[0];	
	});

	var ref_join = this.joinGraphSQL(table.name, ref_tables);

	var ref_field = _.reduce(table.row_alias, function(memo, f) {
		var result;
		if (f.indexOf('.') < 0) {
			result = util.format('%s.%s', table.name, SqlHelper.EncloseSQL(f));
		} else {
			result = util.format('%s.%s', 
					this.graph.table(f.split('.')[0]).name,
					SqlHelper.EncloseSQL(f.split('.')[1])
				);
		}
		if ( ! _.isEmpty(memo)) {
			result = memo + " || ' ' || " + result;
		}
		return result;
	}, '', this);


	var ref_id =  util.format("'[' || %s.id || ']' AS %s", 
		table.name,
		Field.ROW_ALIAS
	);
	
	ref_field = ref_field.length > 0
		? "COALESCE(" + ref_field + ", '') || ' ' || " + ref_id 
		: ref_id;

	var id_field = util.format('%s.id AS id', table.name);

	var fields = [id_field, ref_field];
	var tables = [table.name].concat(ref_join.tables);
	var clauses = ['1=1'].concat(ref_join.clauses);

	var sql = 'CREATE VIEW ' + table.rowAliasView() + ' AS '
		+ ' SELECT ' + fields.join(', ')
		+ ' FROM ' + tables.join(', ')
		+ ' WHERE ' + clauses.join(' AND ') + ';';

	return sql;
}


SqlBuilderSqlite.prototype.joinSearchSQL = function(filterClauses) {
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
			tables: [table.ftsName()],
			clauses: [clause]
		};
		
		return result;

	} else {
		return { tables: [], clauses: [] };
	}
}

exports.SqlBuilderSqlite = SqlBuilderSqlite;

