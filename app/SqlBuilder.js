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
var config = require('config');

var SqlHelper = require('./SqlHelperFactory.js').SqlHelperFactory.create();
var Schema = require('./Schema.js').Schema;
var Table = require('./Table.js').Table;
var Field = require('./Field.js').Field;

var log = require('./log.js').log;

var SqlBuilder = function(tableGraph) {
	this.graph = tableGraph;
}

SqlBuilder.prototype.selectSQL 
	= function(table, fieldClauses, filterClauses, orderClauses, limit, offset) 
{
	log.trace('SqlBuilder.selectSQL...');
	log.trace({
		table: table
		, fieldClauses: fieldClauses
		, filterClauses: filterClauses
		, orderClauses: orderClauses
		, limit: limit, offfset: offset
	}, "SqlBuilder.selectSQL");
	
	var s = {};

	s.fields = this.sanitizeFieldClauses(table, fieldClauses);
	s.filters = this.sanitizeFieldClauses(table, filterClauses);
	s.orders = this.sanitizeFieldClauses(table, orderClauses);
	s.offset = offset || 0;
	s.limit = limit || config.sql.pageRows || 1000;
	
	var query = this.querySQL(table, s.fields, s.filters);

	if (s.orders.length == 0) {
		var defOrder = _.clone(s.fields[0]);
		defOrder.order = 'asc';
		s.orders.push(defOrder);
	}
	var orderSQL = this.orderSQL(table, s.orders);

	var selectSQL = 'SELECT * FROM (' + query.sql + ') AS T '
					+ orderSQL
					+ SqlHelper.OffsetLimitSQL(s.offset, s.limit);

	var countSQL = 'SELECT COUNT(*) as count FROM (' + query.sql + ') AS C';

	var result = {
		'query': selectSQL, 
		'params': query.params,
		'countSql': countSQL,
		'sanitized': s
	}
	log.trace({result: result}, "SqlBuilder.selectSQL");
	return result;
}

SqlBuilder.prototype.statsSQL = function(table, fieldClauses, filterClauses) 
{

	var s = {};
	s.fields = this.sanitizeFieldClauses(table, fieldClauses);
	s.filters = this.sanitizeFieldClauses(table, filterClauses);

	var query = this.querySQL(table, s.fields, s.filters);


	var outerSQL = _.reduce(s.fields, function(memo, f) {
		var s = util.format("min(%s) as min_%s, max(%s) as max_%s ",
							f.alias, f.alias, f.alias, f.alias);
		return (memo.length == 0) ? s : memo + ', ' + s;
	}, '');

	var statsSQL = 'SELECT ' + outerSQL + ' FROM (' + query.sql + ') AS S';

	var result = {
		'query': statsSQL, 
		'params': query.params,
		'sanitized': s
	}
	log.debug({result: result}, "SqlBuilder.statsSQL");
	return result;
}

SqlBuilder.prototype.selectViewSQL 
	= function(viewName, fieldClauses, filterClauses, orderClauses, limit, offset) 
{
	log.trace('SqlBuilder.selectViewSQL...');
	log.trace({
		view: viewName
		, fieldClauses: fieldClauses
		, filterClauses: filterClauses
		, orderClauses: orderClauses
		, limit: limit, offfset: offset
	}, "SqlBuilder.selectViewSQL");
	
	var s = {};

	s.fields = this.buildFieldClauses(viewName, fieldClauses);
	s.filters = this.buildFieldClauses(viewName, filterClauses);
	s.orders = this.buildFieldClauses(viewName, orderClauses);
	s.offset = offset || 0;
	s.limit = limit || config.sql.pageRows || 1000;
	
	var query = this.queryViewSQL(viewName, s.fields, s.filters);
	//var query = { sql: 'SELECT * FROM ' + viewName, params: [] };

	var selectSQL;

	if (s.orders.length > 0) {
		var orderSQL = this.orderSQL(null, s.orders);
		selectSQL = 'SELECT * FROM (' + query.sql + ') AS T '
					+ orderSQL
					+ SqlHelper.OffsetLimitSQL(s.offset, s.limit);
	} else {
		selectSQL = 'SELECT TOP ' + s.limit + ' * FROM (' + query.sql + ') AS T';
	}

	var result = {
		'query': selectSQL, 
		'params': query.params,
		'sanitized': s
	}
	log.debug({result: result}, "SqlBuilder.selectViewSQL");
	return result;
}

// private methods...


SqlBuilder.prototype.buildFieldClause = function(tableName, fc) {
	var item = {};
	if (_.isString(fc)) {
		item = { table: tableName, field: fc, alias: fc };
	} else if (_.isObject(fc) && fc.field) {
		item = _.clone(fc);
		item.table = item.table || tableName;
		item.alias = item.table == tableName
					? item.field
					: item.table 
						+ Table.TABLE_FIELD_SEPARATOR 
						+ item.field;
	} else {
		throw new Error("malformed clause '" + util.inspect(fc) + "'");
	}
	return item;
}

SqlBuilder.prototype.buildFieldClauses = function(viewName, fieldClauses) {
	var result = _.map(fieldClauses, function(fc) {
		return this.buildFieldClause(viewName, fc);
	}, this);

	return result;	
}

SqlBuilder.prototype.sanitizeFieldClauses = function(table, fieldClauses) {

	fieldClauses = fieldClauses == Table.ALL_FIELDS 
				? table.allFieldClauses() : fieldClauses;

	var result = _.map(fieldClauses, function(fc) {
		var item = this.buildFieldClause(table.name, fc);

		//validate
		var fieldTable;
		if (item.table != table.name) {
			fieldTable = this.graph.table(item.table);
		} else {
			fieldTable = table;
		}
		var field = fieldTable.field(item.field);
		if (field) {
			item.valueType = field.type;
		} else if ( _.contains(fieldTable.refFields), item.field) {
			item.valueType = 'text';
		} else {			
			throw new Error("unknown field '" + item.field + "'");
		}

		return item;
	}, this);
	
	return result;		
}

SqlBuilder.prototype.querySQL = function(table, fields, filters) {

	var fkGroups = this.groupForeignKeys(fields, filters);

	var joinSQL = this.joinSQL(table, fields, filters, fkGroups);
	var filterSQL = this.filterSQL(table, filters, fkGroups);
	var fieldSQL = this.fieldSQL(table, fields, fkGroups);

	var tables = [table.name].concat(joinSQL.tables);
	var clauses = ['1=1'].concat(joinSQL.clauses.concat(filterSQL.clauses));

	var selectSQL = 'SELECT DISTINCT ' + fieldSQL 
					+ ' FROM ' + tables.join(', ')
					+ ' WHERE ' + clauses.join(' AND ');

	return {
		'sql': selectSQL, 
		'params': filterSQL.params, 
	};
}

SqlBuilder.prototype.queryViewSQL = function(viewName, fields, filters) {

	var filterSQL = this.filterViewSQL(viewName, filters);
	var clauses = ['1=1'].concat(filterSQL.clauses);

	var fieldSQL = _.map(fields, function(f) {
		return (f.field == '*') ? f.field : SqlHelper.EncloseSQL(f.field);
	}).join(',');

	var selectSQL = 'SELECT DISTINCT ' + fieldSQL 
					+ ' FROM ' + viewName
					+ ' WHERE ' + clauses.join(' AND ');

	return {
		'sql': selectSQL, 
		'params': filterSQL.params, 
	};
}

SqlBuilder.prototype.createDatabaseSQLBatches = function(schema, options) {

	return Promise.all([
		this._createTablesSQLBatches(schema),
		this._createViewsSQLBatches(schema),
		this._createStoredProcsSQLBatches(schema)
		
	]).then(function(result) {
		return _.flatten(result);
	});
}

SqlBuilder.prototype._createTablesSQLBatches = function(schema) {
	var tables = this.graph.tablesByDependencies();	
	var sql = _.map(tables, function(t) {
		return t.createSQL();
	});

	return Promise.resolve(sql);
}

SqlBuilder.prototype._createViewsSQLBatches = function(schema) {
	var tables = this.graph.tables();
	var sql = _.map(tables, function(t) {
		var viewSQL = this.createRowAliasViewSQL(t);
		//log.debug(viewSQL);
		return viewSQL;
	}, this);

	return Promise.resolve(sql);
}

SqlBuilder.prototype._createStoredProcsSQLBatches = function() {
	//overwrite me
}

SqlBuilder.prototype.rowAliasFields = function(table) {
	var fields = _.map(table.row_alias, function(fn) {
		var field;
		if (fn.indexOf('.') < 0) {
			field = table.field(fn);
			field.table = table;	
		} else {
			var refTable = this.graph.table(fn.split('.')[0]);
			field = refTable.field(fn.split('.')[1]);
			field.table = refTable;
		}
		return field;
	}, this);
	return fields;
}

SqlBuilder.prototype.createRowAliasViewSQL = function(table) {

	var fields = this.rowAliasFields(table);

	var ref_tables = _.map(_.filter(fields, function(f) {
		return f.table.name != table.name;
	}), function(f) { 
		return f.table.name; 
	});

	var ref_join = this.joinGraphSQL(table.name, ref_tables);

	var ref_field = _.reduce(fields, function(memo, field) {
		var term = util.format('%s.%s', field.table.name, SqlHelper.EncloseSQL(field.name));
		if (field.typeName() != 'text') {
			term = util.format('CAST(%s AS VARCHAR(256))', term);
		}
		if ( ! _.isEmpty(memo)) {
			return SqlHelper.ConcatSQL([memo, "' '", term]);
		}
		return term;
	}, '', this);

	var fmt = SqlHelper.ConcatSQL(["'['", 'CAST(%s.id AS VARCHAR(64))', "']'"]) + ' AS %s';
	var ref_id =  util.format(fmt, table.name, Field.ROW_ALIAS);
	var coalesceField = "COALESCE(" + ref_field + ", '')";

	ref_field = ref_field.length > 0
		? SqlHelper.ConcatSQL([coalesceField, "' '", ref_id]) 
		: ref_id;

	var id_field = util.format('%s.id AS id', table.name);

	var fields = [id_field, ref_field];
	var tables = [table.name].concat(ref_join.tables);
	var clauses = ['1=1'].concat(ref_join.clauses);

	var sql = 'CREATE VIEW ' + table.rowAliasView() + ' AS '
		+ ' SELECT ' + fields.join(', ')
		+ ' FROM ' + tables.join(', ')
		+ ' WHERE ' + clauses.join(' AND ') + ';\n';

	return sql;
}


SqlBuilder.prototype.joinSQL = function(fromTable, fields, filterClauses, fkGroups) {

	var result = {
		tables: [],
		clauses: []
	};

	var rowAliasSQL = this.joinRowAliasSQL(fields, filterClauses, fkGroups);
	result.tables = result.tables.concat(rowAliasSQL.tables);
	result.clauses = result.clauses.concat(rowAliasSQL.clauses);

	var tableSQL = this.joinTableSQL(fromTable, fields, filterClauses, fkGroups);
	result.tables = result.tables.concat(tableSQL.tables);
	result.clauses = result.clauses.concat(tableSQL.clauses);

	log.trace({ result: result }, '...SqlBuilder.joinSQL()');
	return result;
}

SqlBuilder.prototype.joinRowAliasSQL = function(fieldClauses, filterClauses, fkGroups) {
	log.trace({ fieldClauses: fieldClauses, filterClauses: filterClauses }
			, 'SqlBuilder.joinRowAliasSQL()...');

	var result = { tables: [], clauses: [] };
	var tables = {};

	var clauses = fieldClauses.concat(filterClauses);

	_.each(clauses, function(fc) {
		var table = this.graph.table(fc.table);
		var fk = _.find(table.foreignKeys(), function(fk) {
			return fk.refName() == fc.field;
		});

		if (fc.field == Field.ROW_ALIAS) {
			var rowAliasSQL = table.rowAliasSQL();
			if ( ! tables[rowAliasSQL.table] ) {
				result.tables.push(rowAliasSQL.table); 		
				result.clauses.push(rowAliasSQL.clause); 		
				tables[rowAliasSQL.table] = rowAliasSQL.table;
			}

		} else if (fk) {
			var idx = fkGroups[fk.fk_table].indexOf(fc.field) + 1;
			var ref = table.fkAliasSQL(fk, idx);
			var refTable = util.format('%s AS %s', ref.table, ref.alias); 
			if ( ! tables[refTable] ) {
				result.tables.push(refTable); 		
				result.clauses.push(ref.clause); 		
				tables[refTable] = refTable;
			}
		}
	}, this);

	log.trace({ result: result }, '...SqlBuilder.joinRowAliasSQL()');
	return result;
}

SqlBuilder.prototype.joinGraphSQL = function(fromTable, tables) {

	log.trace('SqlBuilder.joinGraphSQL()...');
	log.trace({from: fromTable, join: tables});

	var joinTables = _.without(_.uniq(tables), fromTable).sort();
	if (joinTables.length == 0) {
		return  { tables: [], clauses: [] };
	}

	var joinPath = this.graph.tableJoins(fromTable, joinTables);
	if ( ! joinPath) {
		return { tables: joinTables, clauses: [] }; //no join clause
	}

	var me = this;

	var sqlTables = _.map(joinPath, function(join) {
		return join.join_table;
	});

	var sqlClauses = _.map(joinPath, function(join) {
		var idTable = join.id_table;
		var fkTable = join.fk_table;
		var joinQuery = _.map(join.fk, function(fk) {
			return util.format('%s.id = %s.%s', idTable, fkTable, SqlHelper.EncloseSQL(fk));
		});		
		
		return '(' + joinQuery.join(' OR ') + ')';
	});


	var result = {
		tables: sqlTables,
		clauses: sqlClauses
	};
		
	log.trace({result: result}, '...SqlBuilder.joinGraphSQL()');
	return result;


}

SqlBuilder.prototype.filterViewSQL = function(fromView, filterClauses) {
	var sqlClauses = [];
	var sqlParams = [];

	_.each(filterClauses, function(filter) {

		filter.fqn =util.format('%s.%s',
				filter.table, SqlHelper.EncloseSQL(filter.field));

		var sql = this.filterToSQLClause(filter);

		if (sql.clause) sqlClauses.push(sql.clause);
		sqlParams = sqlParams.concat(sql.params); 
		
	}, this);

	return { 
		clauses: sqlClauses,
		params: sqlParams
	};
}

SqlBuilder.prototype.filterSQL = function(fromTable, filterClauses, fkGroups) {

	var sqlClauses = [];
	var sqlParams = [];

	_.each(filterClauses, function(filter) {

		var table = this.graph.table(filter.table);
		var fk = _.find(table.foreignKeys(), function(fk) {
			return fk.refName() == filter.field;
		});

		if (filter.field == Field.ROW_ALIAS) {
			//var idx = fkGroups[fc.table].indexOf(fc.field) + 1;
			filter.fqn = util.format('%s.%s',
					table.rowAliasView(), SqlHelper.EncloseSQL(filter.field));

		} else if (fk) {
			var idx = fkGroups[fk.fk_table].indexOf(filter.field) + 1;
			filter.fqn =util.format('%s.%s',
					Table.rowAliasView(fk.fk_table, idx), 
					SqlHelper.EncloseSQL(Field.ROW_ALIAS));

		} else {
			filter.fqn =util.format('%s.%s',
					filter.table, SqlHelper.EncloseSQL(filter.field));
		}

		var sql = this.filterToSQLClause(filter);

		if (sql.clause) sqlClauses.push(sql.clause);
		sqlParams = sqlParams.concat(sql.params); 
		
	}, this);

	return { 
		clauses: sqlClauses,
		params: sqlParams
	};
}

SqlBuilder.prototype.filterToParams = function(filter)
{
	var values = _.isArray(filter.value) ? filter.value : [ filter.value ]; 
	return _.map(values, function(v, idx) {
		return SqlHelper.param({
			name: filter.alias + (idx+1), 
			value: v,
			type: filter.valueType
		});
	});
}

SqlBuilder.ConvertToStringSQL = function(typeName, fieldName) {
    if (typeName == 'date') return SqlHelper.dateToStringSQL(fieldName);
    else if (typeName == 'timestamp') return SqlHelper.timestampToStringSQL(fieldName);
	else return util.format('CONVERT(VARCHAR, %s)', fieldName);
}

SqlBuilder.prototype.filterToSQLClause = function(filter) {

	var clause;
	var params = [];

	var comparatorOperators = {
		'eq' : '=', 
		'ne' : '!=',	
		'ge': '>=', 
		'gt': '>', 
		'le': '<=', 
		'lt': '<'
	};
	if (comparatorOperators[filter.op] && filter.value !== null) {

		params = this.filterToParams(filter);
		clause = util.format('(%s %s %s)', 
					filter.fqn, comparatorOperators[filter.op], params[0].sql);


	} else if (filter.op == 'eq' && filter.value === null) {
		clause = util.format('(%s is null)', filter.fqn);

	} else if (filter.op == 'ne' && filter.value === null) {
		clause = util.format('(%s is not null)', filter.fqn);

	} else if (filter.op == 'btwn') {

		if ( ! filter.value.length == 2) {
			throw new Error(
				util.format("filter.value %s mismatch", filter.value));
		}

		params = this.filterToParams(filter);	
		clause = util.format('(%s BETWEEN %s AND %s)', filter.fqn, params[0].sql, params[1].sql);

	} else if (filter.op == 'in') {

		if ( ! filter.value.length > 0) {
			throw new Error(
				util.format("filter.value %s mismatch", filter.value));
		}

		params = this.filterToParams(filter);
		clause = util.format('(%s IN (%s))',
					filter.fqn, _.pluck(params, 'sql').join(','));

/*					
	} else if (filter.op == 'childless') {
		//filter out all rows in filter.table 
		//leaving only rows in parent table without a join to this
//TODO adjust joinSQL to join with parent table instead of filter.table
		var field = table.field(filter.field);
		if (field.fk == 1) {
			clause = util.format('(%s.id NOT IN (SELECT DISTINCT %s FROM %s))'
						, field.fk_table, SqlHelper.EncloseSQL(filter.field), filter.table);

		} else {
			throw new Error("childless filter works only on foreign keys");
		}
*/

	} else if (filter.op == 'search') {

		if (filter.field == Table.ALL_FIELDS) {

			var s = this.filterSearchSQL(filter);
			clause = s.clause;
			params = s.params;

		} else {
			//use LIKE on filter.field
			var fieldType = filter.valueType;	
			var searchValue = filter.value + '%';
			if (filter.value[0] == '*') {
				searchValue = '%' + filter.value.substr(1) + '%';
			}
			
			filter.value = searchValue;				
			filter.valueType = 'text';

			params = this.filterToParams(filter);

			clause = util.format('(%s LIKE %s)', 
				SqlBuilder.ConvertToStringSQL(fieldType, filter.fqn), params[0].sql);
			
		}

	} else {
		//unknown op
		throw new Error("unknown filter op '" + filter.op + "'");
	}

	return { clause: clause, params: params };
}

SqlBuilder.prototype.groupForeignKeys = function(fieldClauses, filterClauses) {

	var refGroups = {};

	_.each(fieldClauses, function(fc) {

		var table = this.graph.table(fc.table);	
		var fk = _.find(table.foreignKeys(), function(fk) {
			return fk.refName() == fc.field;
		});

		if (fc.field == Field.ROW_ALIAS) {
			refGroups[fc.table] = refGroups[fc.table] || [];
			refGroups[fc.table].push(fc.field);

		} else if (fk) {
			refGroups[fk.fk_table] = refGroups[fk.fk_table] || [];
			refGroups[fk.fk_table].push(fc.field);
		}
	}, this);

	_.each(filterClauses, function(fc) {

		var table = this.graph.table(fc.table);	
		var fk = _.find(table.foreignKeys(), function(fk) {
			return fk.refName() == fc.field;
		});

		if (fc.field == Field.ROW_ALIAS) {
			refGroups[fc.table] = refGroups[fc.table] || [];
			if (refGroups[fc.table].indexOf(fc.field) < 0)
				refGroups[fc.table].push(fc.field);

		} else if (fk) {
			refGroups[fk.fk_table] = refGroups[fk.fk_table] || [];
			if (refGroups[fk.fk_table].indexOf(fc.field) < 0)
				refGroups[fk.fk_table].push(fc.field);
		}
	}, this);

/*
	console.log('------- refGroups --------');
	console.log(util.inspect(refGroups, false, null));
*/
	return refGroups;
}

SqlBuilder.prototype.fieldSQL = function(table, fieldClauses, fkGroups) {

	var result = _.map(fieldClauses, function(fc) {
		
		var table = this.graph.table(fc.table);	
		var field = table.field(fc.field);	

		var fk = _.find(table.foreignKeys(), function(fk) {
			return fk.refName() == fc.field;
		});

		if (fc.field == Field.ROW_ALIAS) {
			//var idx = fkGroups[fc.table].indexOf(fc.field) + 1;
			return util.format('%s.%s AS %s',
					table.rowAliasView(), SqlHelper.EncloseSQL(fc.field), SqlHelper.EncloseSQL(fc.alias));

		} else if (fk) {
			var idx = fkGroups[fk.fk_table].indexOf(fc.field) + 1;
			return util.format('%s.%s AS %s',
					Table.rowAliasView(fk.fk_table, idx), 
					SqlHelper.EncloseSQL(Field.ROW_ALIAS), 
					SqlHelper.EncloseSQL(fc.alias));
/*
		} else if (field.type == 'date') {
			var fieldNameQN = util.format('%s.%s', fc.table, SqlHelper.EncloseSQL(fc.field));
			return util.format('%s AS %s',
					SqlHelper.dateToStringSQL(fieldNameQN), 
					SqlHelper.EncloseSQL(fc.alias));

		} else if (field.type == 'timestamp') {
			var fieldNameQN = util.format('%s.%s', fc.table, SqlHelper.EncloseSQL(fc.field));
			return util.format('%s AS %s',
					SqlHelper.timestampToStringSQL(fieldNameQN), 
					SqlHelper.EncloseSQL(fc.alias));
*/
		} else {
			var fieldNameQN = util.format('%s.%s', fc.table, SqlHelper.EncloseSQL(fc.field));
			return util.format('%s AS %s', fieldNameQN, SqlHelper.EncloseSQL(fc.alias));
		}

	}, this);

	return result.join(",");
}

SqlBuilder.prototype.orderSQL = function(table, orderClauses) {

	if ( _.isEmpty(orderClauses)) {	
		throw new Error('no order clause given');
	}

	var orderSQL = _.reduce(orderClauses, function(memo, order, idx) {
		var dir = order.order.toUpperCase();
		
		if ( ! _.contains(['ASC', 'DESC'], dir)) {
			throw new Error(util.format("order dir '%s' invalid", dir));
		}
		
		var result = memo + util.format('%s %s', SqlHelper.EncloseSQL(order.alias), dir);

		if (idx < orderClauses.length-1) result = result + ',';
		return result;
		
	}, 'ORDER BY ');
		
	return orderSQL;
}

SqlBuilder.prototype.chownSQL = function(rowTable, rowIds, chownTable, owner) {
	var fieldClauses = this.sanitizeFieldClauses(chownTable, ['id']);

	var filter = { 
		table: rowTable.name
		, field: 'id'
		, op: 'in'
		, value: rowIds 
	};

	var filterClauses = this.sanitizeFieldClauses(rowTable, [ filter ]);						
	var inQuery = this.querySQL(chownTable, fieldClauses, filterClauses);

	var ownParam = SqlHelper.param({
		name: 'owner', value: owner, type: 'text'
	});

	//console.log(JSON.stringify(ownParam));

	var sql = "UPDATE " + chownTable.name 
			+ " SET own_by = " + ownParam.sql
			+ " WHERE id IN (" + inQuery.sql + ")";

	return 	{ sql: sql, params: [ ownParam ].concat(inQuery.params) };
}

exports.SqlBuilder = SqlBuilder;

