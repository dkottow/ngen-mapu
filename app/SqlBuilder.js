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

var Field = require('./Field.js').Field;
var Table = require('./Table.js').Table;

//ugly but avoids circular requires with Schema.js
var Schema = {
	PragmaSQL: "PRAGMA journal_mode=WAL;\n\n",
	CreateTableSQL: "CREATE TABLE __schemaprops__ ("
		+ " name VARCHAR NOT NULL, "
		+ "	value VARCHAR, "
		+ "	PRIMARY KEY (name) "
		+ ");\n\n"
};


var log = require('./log.js').log;

var SqlBuilder = function(tableGraph) {
	this.graph = tableGraph;
}

SqlBuilder.prototype.selectSQL 
	= function(table, fieldExpr, filterClauses, orderClauses, limit, offset) 
{
	log.trace('SqlBuilder.selectSQL...');
	log.trace({
		table: table
		, fieldExpr: fieldExpr
		, filterClauses: filterClauses
		, orderClauses: orderClauses
		, limit: limit, offfset: offset
	}, "SqlBuilder.selectSQL");
	
	var s = {};

	s.fields = this.sanitizeFieldClauses(table, fieldExpr);
	s.filters = this.sanitizeFieldClauses(table, filterClauses);
	s.orders = this.sanitizeFieldClauses(table, orderClauses);
	
	var query = this.querySQL(table, s.fields, s.filters);

	var orderSQL = this.orderSQL(table, s.orders);

	var selectSQL = 'SELECT * FROM (' + query.sql + ') '
					+ orderSQL
					+ ' LIMIT ' + limit
					+ ' OFFSET ' + offset;

	var countSQL = 'SELECT COUNT(*) as count FROM (' + query.sql + ')';

	var result = {
		'query': selectSQL, 
		'params': query.params,
		'countSql': countSQL,
		'sanitized': s
	}
	log.trace({result: result}, "SqlBuilder.selectSQL");
	return result;
}

SqlBuilder.prototype.statsSQL = function(table, fieldExpr, filterClauses) 
{

	var s = {};
	s.fields = this.sanitizeFieldClauses(table, fieldExpr);
	s.filters = this.sanitizeFieldClauses(table, filterClauses);

	var query = this.querySQL(table, s.fields, s.filters);


	var outerSQL = _.reduce(s.fields, function(memo, f) {
		var s = util.format("min(%s) as min_%s, max(%s) as max_%s ",
							f.alias, f.alias, f.alias, f.alias);
		return (memo.length == 0) ? s : memo + ', ' + s;
	}, '');

	var statsSQL = 'SELECT ' + outerSQL + ' FROM (' + query.sql + ')';

	var result = {
		'query': statsSQL, 
		'params': query.params,
		'sanitized': s
	}
	log.trace({result: result}, "SqlBuilder.statsSQL");
	return result;
}

SqlBuilder.prototype.createTableSQL = function(table) {
	return table.createSQL()
		+ this.createRowAliasViewSQL(table)
		+ table.createSearchSQL();
}

SqlBuilder.prototype.createSQL = function(schema) {
	var createSysTablesSQL = Schema.PragmaSQL
			+ Schema.CreateTableSQL
			+ Table.CreateTableSQL
			+ Field.CreateTableSQL;

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
		return t.createSearchSQL();
	}).join('\n');

	var sql = createSysTablesSQL + '\n\n'
			+ sysTablesInsertSQL + '\n\n'
			+ createTableSQL + '\n\n'
			+ createRowAliasViewSQL + '\n\n'
			+ createSearchSQL + '\n\n';
	
	log.debug({sql: sql}, 'SqlBuilder.createSQL');
	return sql;
}

/*
SqlBuilder.prototype.updatePropSQL = function(patches) {
	//only table props or deeper supported

	var me = this;
	var tables = _.groupBy(patches, function(patch) {
		return patch.table.name;				
	});
	var sql = _.reduce(tables, function(memo, patches) {
		return memo + patches[0].table.updatePropSQL();
	}, '');
	log.trace({sql: sql}, "SqlBuilder.updatePropSQL");

	return sql;
}
*/

// private methods...

SqlBuilder.prototype.sanitizeFieldClauses = function(table, fieldClauses) {

	fieldClauses = fieldClauses == Table.ALL_FIELDS 
				? table.allFieldClauses() : fieldClauses;

	var result = _.map(fieldClauses, function(fc) {
		var item = {};
		if (_.isString(fc)) {
			item = { table: table.name, field: fc, alias: fc };
		} else if (_.isObject(fc) && fc.field) {
			item = _.clone(fc);
			item.table = item.table || table.name;
			item.alias = item.table == table.name
						? item.field
						: item.table 
							+ Table.TABLE_FIELD_SEPARATOR 
							+ item.field;
		} else {
			throw new Error("malformed filter item '" + util.inspect(fc) + "'");
		}

		//validate
		if (item.table != table.name) {
			this.graph.assertTable(item.table);
			var t = this.graph.table(item.table);
			t.assertQueryField(item.field);
		} else {
			table.assertQueryField(item.field);
		}
		
		return item;
	}, this);
	
	return result;		
}

SqlBuilder.prototype.querySQL = function(table, fields, filterClauses) {

	var joinSQL = this.joinSQL(table, fields, filterClauses);
	var filterSQL = this.filterSQL(table, filterClauses);
	var fieldSQL = this.fieldSQL(table, fields);

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

SqlBuilder.prototype.createRowAliasViewSQL = function(table) {

	var ref_tables = _.map(_.filter(table.row_alias, function(ref) {
			return ref.indexOf('.') >= 0;		
		}), function(ref) {
		return ref.split('.')[0];	
	});

	var ref_join = this.joinGraphSQL(table.name, ref_tables);

	var ref_field = _.reduce(table.row_alias, function(memo, f) {
		var result;
		if (f.indexOf('.') < 0) {
			result = util.format('%s."%s"', table.name, f);
		} else {
			result = util.format('%s."%s"', 
				this.graph.table(f.split('.')[0]).name,
				f.split('.')[1]);
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

SqlBuilder.prototype.joinSQL = function(fromTable, fields, filterClauses) {

	var result = {
		tables: [],
		clauses: []
	};

	var rowAliasSQL = this.joinRowAliasSQL(fields, filterClauses);
	result.tables = result.tables.concat(rowAliasSQL.tables);
	result.clauses = result.clauses.concat(rowAliasSQL.clauses);

	//collect filter and field tables
	var joinTables = _.pluck(filterClauses, 'table')
		.concat(_.pluck(fields, 'table'));

	var graphSQL = this.joinGraphSQL(fromTable.name, joinTables);
	result.tables = result.tables.concat(graphSQL.tables);
	result.clauses = result.clauses.concat(graphSQL.clauses);

	var searchSQL = this.joinSearchSQL(filterClauses);
	result.tables = result.tables.concat(searchSQL.tables);
	result.clauses = result.clauses.concat(searchSQL.clauses);

	log.debug({ result: result }, '...SqlBuilder.joinSQL()');
	return result;
}

SqlBuilder.prototype.joinRowAliasSQL = function(fieldClauses, filterClauses) {
	log.trace({ fieldClauses: fieldClauses, filterClauses: filterClauses }
			, 'SqlBuilder.joinRowAliasSQL()...');

	var result = { tables: [], clauses: [] };

	var fkGroups = this.groupForeignKeys(fieldClauses);

	_.each(fieldClauses, function(fc) {
		var table = this.graph.table(fc.table);
		var fk = _.find(table.foreignKeys(), function(fk) {
			return fk.refName() == fc.field;
		});

		if (fc.field == Field.ROW_ALIAS) {
			var rowAliasSQL = table.rowAliasSQL();
			result.tables.push(rowAliasSQL.table); 		
			result.clauses.push(rowAliasSQL.clause); 		

		} else if (fk) {
			var idx = fkGroups[fk.fk_table].indexOf(fc) + 1;
			var ref = table.fkAliasSQL(fk, idx);
			var refTable = util.format('%s AS %s', ref.table, ref.alias); 
			result.tables.push(refTable); 		
			result.clauses.push(ref.clause); 		
		}
	}, this);

	//TODO filterClauses

	log.debug({ result: result }, '...SqlBuilder.joinRowAliasSQL()');
	return result;
}

SqlBuilder.prototype.joinGraphSQL = function(fromTable, tables) {

	log.trace('SqlBuilder.joinSQL()...');
	log.trace({from: fromTable, join: tables});

	var joinTables = _.without(_.uniq(tables), fromTable).sort();
	if (joinTables.length == 0) {
		return  { tables: [], clauses: [] };
	}

	var joinPath = this.graph.tableJoins(fromTable, joinTables);
	
	var me = this;

	var sqlTables = _.map(joinPath, function(join) {
		return join.join_table;
	});

	var sqlClauses = _.map(joinPath, function(join) {
		var idTable = join.id_table;
		var fkTable = join.fk_table;
		var joinQuery = _.map(join.fk, function(fk) {
			return util.format('%s.id = %s."%s"', idTable, fkTable, fk);
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

SqlBuilder.prototype.filterSQL = function(fromTable, filterClauses) {

	var me = this;
	var sqlClauses = [];
	var sqlParams = [];

	_.each(filterClauses, function(filter) {
		var table = me.graph.table(filter.table);

		var comparatorOperators = {
			'eq' : '=', 
			'ne' : '!=',	
			'ge': '>=', 
			'gt': '>', 
			'le': '<=', 
			'lt': '<'
		};

		var fieldName = table.name == fromTable.name 
						? '"' + filter.field + '"'
						: util.format('%s."%s"', table.name, filter.field);

		if (comparatorOperators[filter.op]) {

			var clause = util.format('(%s %s ?)', 
							fieldName, comparatorOperators[filter.op]);

			sqlClauses.push(clause);
			sqlParams.push(filter.value);

		} else if (filter.op == 'btwn') {

			if ( ! filter.value.length == 2) {
				throw new Error(
					util.format("filter.value %s mismatch", filter.value));
			}

			var clause = util.format('(%s BETWEEN ? AND ?)', fieldName);
				
			sqlClauses.push(clause);
			sqlParams.push(filter.value[0]);
			sqlParams.push(filter.value[1]);


		} else if (filter.op == 'in') {

			if ( ! filter.value.length > 0) {
				throw new Error(
					util.format("filter.value %s mismatch", filter.value));
			}

			var inParams = _.times(filter.value.length, function(fn) { 
					return "?"; 
			});

			var clause = util.format('(%s IN (%s))',
							fieldName, inParams.join(','));

			sqlClauses.push(clause);
			sqlParams = sqlParams.concat(filter.value); 

		} else if (filter.op == 'search') {

			if (filter.field == Table.ALL_FIELDS) {
				//use full text search (fts)
				var clause = util.format('(%s."%s" MATCH ?)', 
								table.ftsName(), table.ftsName()); 	

				sqlClauses.push(clause);
		
				//(prefix last + phrase query) - see sqlite fts
				var searchValue = '"' + filter.value + '*"';  
				sqlParams.push(searchValue);

			} else {
				//use LIKE on filter.field
				var clause = util.format('(%s || ' + "''" + ' LIKE ?)',
								fieldName);
			
				sqlClauses.push(clause);

				var searchValue = filter.value + '%';
				if (filter.value[0] == '*') {
					searchValue = '%' + filter.value.substr(1) + '%';
				}
				sqlParams.push(searchValue); 
			}

		} else {
			//unknown op
			throw new Error("unknown filter op '" + filter.op + "'");
		}

	});

	return { 
		clauses: sqlClauses,
		params: sqlParams
	};
}

SqlBuilder.prototype.joinSearchSQL = function(filterClauses) {
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

SqlBuilder.prototype.groupForeignKeys = function(fieldClauses) {

	var refGroups = {};

	_.each(fieldClauses, function(fc) {

		var table = this.graph.table(fc.table);	
		var fk = _.find(table.foreignKeys(), function(fk) {
			return fk.refName() == fc.field;
		});

		if (fc.field == Field.ROW_ALIAS) {
			refGroups[fc.table] = refGroups[fc.table] || [];
			refGroups[fc.table].push(fc);

		} else if (fk) {
			refGroups[fk.fk_table] = refGroups[fk.fk_table] || [];
			refGroups[fk.fk_table].push(fc);
		}
	}, this);

/*
	console.log('------- refGroups --------');
	console.log(util.inspect(refGroups, false, null));
*/
	return refGroups;
/*
	var me = this;
	var refFields = {};
	var refFn = function(table) { 
		if ( ! refFields[table]) { 
			refFields[table] = me.graph.table(table).refFields();
		}
		return refFields[table];
	}
	var refClauses = _.filter(fieldClauses, function(fc) {
		return _.contains(refFn(fc.table), fc.field);
	});

	//group refClauses by table to number view row alias tables
	//e.g. vra_team as vra_team01, vra_team as vra_team02 etc.
	var refGroups = _.groupBy(refClauses, function(fc) {
		return fc.table;
	});

	console.log(util.inspect(refGroups, false, null));

	return refGroups;
*/
}

SqlBuilder.prototype.fieldSQL = function(table, fieldClauses) {

	var fkGroups = this.groupForeignKeys(fieldClauses);

	var result = _.map(fieldClauses, function(fc) {
		
		var table = this.graph.table(fc.table);	
		var fk = _.find(table.foreignKeys(), function(fk) {
			return fk.refName() == fc.field;
		});

		if (fc.field == Field.ROW_ALIAS) {
			var idx = fkGroups[fc.table].indexOf(fc) + 1;
			return util.format('%s."%s" AS "%s"',
					table.rowAliasView(), fc.field, fc.alias);

		} else if (fk) {
			var idx = fkGroups[fk.fk_table].indexOf(fc) + 1;
			return util.format('%s."%s" AS "%s"',
					Table.rowAliasView(fk.fk_table, idx), 
					Field.ROW_ALIAS, 
					fc.alias);

		} else {
			return util.format('%s."%s" AS "%s"',
					fc.table, fc.field, fc.alias);
		}

	}, this);

	return result.join(",");
}

SqlBuilder.prototype.orderSQL = function(table, orderClauses) {

	var orderSQL = '';
	if ( ! _.isEmpty(orderClauses)) {	
		
		orderSQL = _.reduce(orderClauses, function(memo, order, idx) {
			var dir = order.order.toUpperCase();
			
			if ( ! _.contains(['ASC', 'DESC'], dir)) {
				throw new Error(util.format("order dir '%s' invalid", dir));
			}
			
			var result = memo + util.format('"%s" %s', order.alias, dir);

			if (idx < orderClauses.length-1) result = result + ',';
			return result;
			
		}, 'ORDER BY ');
		
	} 
	return orderSQL;
}

exports.SqlBuilder = SqlBuilder;

