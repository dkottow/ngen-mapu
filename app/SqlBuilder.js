var _ = require('underscore');
var util = require('util');
var assert = require('assert');

var Field = require('./Field.js').Field;
var Table = require('./Table.js').Table;

//ugly but avoids circular requires with Schema.js
var Schema_CreateTableSQL = "CREATE TABLE __schemaprops__ ("
		+ " name VARCHAR NOT NULL, "
		+ "	value VARCHAR, "
		+ "	PRIMARY KEY (name) "
		+ ");\n\n";



var log = global.log.child({'mod': 'g6.SqlBuilder.js'});

var SqlBuilder = function(tableGraph) {
	this.graph = tableGraph;
}

SqlBuilder.prototype.selectSQL 
	= function(table, fields, filterClauses, orderClauses, limit, offset) 
{
	assert(_.isArray(orderClauses), "arg 'orderClauses' is array");
	assert(_.isNumber(limit), "arg limit must be integer");
	assert(_.isNumber(offset), "arg offset must be integer");

	var query = this.querySQL(table, fields, filterClauses);

	var orderSQL = this.orderSQL(table, orderClauses);

	var selectSQL = 'SELECT * FROM (' + query.sql + ')'
					+ orderSQL
					+ ' LIMIT ' + limit
					+ ' OFFSET ' + offset;

	var countSQL = 'SELECT COUNT(*) as count FROM (' + query.sql + ')';

	var result = {
		'query': selectSQL, 
		'params': query.params,
		'countSql': countSQL
	}
	log.debug({result: result}, "SqlBuilder.selectSQL");
	return result;
}

SqlBuilder.prototype.statsSQL = function(table, fields, filterClauses) 
{
	var query = this.querySQL(table, fields, filterClauses);


	var outerSQL = _.reduce(fields, function(memo, f) {
		var s = util.format("min(%s) as min_%s, max(%s) as max_%s ",
							f, f, f, f);
		return (memo.length == 0) ? s : memo + ', ' + s;
	}, '');

	var statsSQL = 'SELECT ' + outerSQL + ' FROM (' + query.sql + ')';

	var result = {
		'query': statsSQL, 
		'params': query.params
	}
	log.debug({result: result}, "SqlBuilder.statsSQL");
	return result;
}

SqlBuilder.prototype.createSQL = function(schema) {
	var createSysTablesSQL = Schema_CreateTableSQL
			+ Table.CreateTableSQL
			+ Field.CreateTableSQL;

	var sysTablesInsertSQL = _.map(this.graph.tables(), function(t) {
		return t.insertPropSQL();
	}).join('\n');

	sysTablesInsertSQL = sysTablesInsertSQL + '\n'
		+ schema.insertPropSQL(); 

	var tables = this.graph.tablesByDependencies();

	var createTableSQL = _.map(tables, function(t) {
		return t.createSQL();
	}).join('\n');

	var createViewSQL = _.map(tables, function(t) {
		var viewSQL = this.createViewSQL(t);
		log.debug(viewSQL);
		return viewSQL;
	}, this).join('\n');

	var createSearchSQL = _.map(tables, function(t) {
		return t.createSearchSQL();
	}).join('\n');

	var sql = createSysTablesSQL + '\n\n'
			+ sysTablesInsertSQL + '\n\n'
			+ createTableSQL + '\n\n'
			+ createViewSQL + '\n\n'
			+ createSearchSQL + '\n\n';
	
	log.debug({sql: sql}, 'SqlBuilder.createSQL');
	return sql;
}

SqlBuilder.prototype.updatePropSQL = function(patches) {
	var me = this;
	var tables = _.groupBy(patches, function(ph) {
		return ph.table.name;				
	});
	var sql = _.reduce(tables, function(memo, patches) {
		return memo + patches[0].table.updatePropSQL();
	}, '');
	log.debug({sql: sql}, "SqlBuilder.updatePropSQL");

	return sql;
}

// private methods...


SqlBuilder.prototype.querySQL = function(table, fields, filterClauses) {

	assert(_.isObject(table), "arg 'table' is object");
	assert(fields == '*' || _.isArray(fields), "arg 'fields' is '*' or array");
	assert(_.isArray(filterClauses), "arg 'filterClauses' is array");
	
	//full qualify filterClauses
	_.each(filterClauses, function(fc) {
		if ( ! fc.table) fc.table = table.name;
	});

	//collect filter tables
	var joinTables = _.map(filterClauses, function(fc) {
			return fc.table;
	})

	//collect additional field tables
	if (fields != '*') {
		var fieldTables = _.map(fields, function(f) {
			if (f.indexOf('.') < 0) return table.name;
			else return f.split('.')[0];
		});
		joinTables = joinTables.concat(fieldTables);
	}	

	var joinSQL = this.joinSQL(table.name, joinTables, { joinViews: true });

	var joinSearchSQL = this.joinSearchSQL(filterClauses);
	var filterSQL = this.filterSQL(filterClauses);
	var fieldSQL = this.fieldSQL(table, fields);


	var selectSQL = 'SELECT DISTINCT ' + fieldSQL 
					+ ' FROM ' + table.viewName() 
					+ joinSQL.tables + joinSearchSQL.tables
					+ ' WHERE 1=1 ' 
					+ joinSQL.query 
					+ joinSearchSQL.query 
					+ filterSQL.query; 

	return {
		'sql': selectSQL, 
		'params': filterSQL.params, 
	};
}

SqlBuilder.prototype.createViewSQL = function(table) {
	var me = this;
	
	//group foreign keys by referenced table to number referenced tables
	//e.g. persons as persons01, persons as persons02 etc.
	var fk_groups = _.groupBy(table.foreignKeys(), function(fk) {
		return fk.fk_table;
	});
	var aliasFn = function(fk) {
		return 'v_' + fk.fk_table
			+ ('00' + (fk_groups[fk.fk_table].indexOf(fk) + 1)).substr(-2);
	}

	var fk_tables = _.map(table.foreignKeys(), function(fk) {
		var fk_table = me.graph.table(fk.fk_table);
		return util.format('%s AS %s', fk_table.viewName(), aliasFn(fk));
	});

	var fk_clauses = _.map(table.foreignKeys(), function(fk) {
		var fk_table = me.graph.table(fk.fk_table);

		return util.format('%s.id = %s."%s"', 
			aliasFn(fk), table.name, fk.name);
	});

	var fk_join = { tables: '', query: '' };
	if (fk_tables.length > 0) {
		fk_join = {
			tables: ', ' + fk_tables.join(', '),
			query: ' AND ' + fk_clauses.join(' AND ')
		};
	}

		
	//TODO make sure row_alias only references existing table/fields

	var ref_tables = _.map(_.filter(table.row_alias, function(ref) {
			return ref.indexOf('.') >= 0;		
		}), function(ref) {
		return ref.split('.')[0];	
	});

	var ref_join = this.joinSQL(table.name, ref_tables, { joinViews: true });
	var r = new RegExp('\\b' + table.viewName() + '\\b', 'g');
	ref_join.query = ref_join.query.replace(r, table.name);

	var fk_fields = _.map(table.foreignKeys(), function(fk) {
		return util.format('%s."%s" AS "%s"', 
			aliasFn(fk), Field.REF_NAME, 
			fk.refName()); 
	});

	var ref_field = _.reduce(table.row_alias, function(memo, f) {
		var result;
		if (f.indexOf('.') < 0) {
			result = util.format('%s."%s"', table.name, f);
		} else {
			result = util.format('%s."%s"', 
				me.graph.table(f.split('.')[0]).viewName(),
				f.split('.')[1]);
		}
		if ( ! _.isEmpty(memo)) {
			result = memo + " || ' ' || " + result;
		}
		return result;
	}, '');


	var ref_id =  util.format("'[' || %s.id || ']' AS %s", 
		table.name,
		Field.REF_NAME
	);
	
	ref_field = ref_field.length > 0
		? "COALESCE(" + ref_field + ", '') || ' ' || " + ref_id 
		: ref_id;

	var table_fields = _.map(table.fields, function(f) {
		return util.format('%s."%s" AS "%s"', table.name, f.name, f.name);
	});

	var fields = [ref_field].concat(table_fields).concat(fk_fields);

	var sql = 'CREATE VIEW ' + table.viewName() + ' AS '
		+ ' SELECT ' + fields.join(', ')
		+ ' FROM ' + table.name + ref_join.tables + fk_join.tables
		+ ' WHERE 1=1 ' + ref_join.query + fk_join.query + ';';

	return sql;
}

SqlBuilder.prototype.joinSQL = function(fromTable, tables, options) {

	log.debug({from: fromTable, join: tables}, 'SqlBuilder.joinSQL()...');
	options = options || {};

	var joinTables = _.without(_.uniq(tables), fromTable).sort();
	if (joinTables.length == 0) {
		return  { tables: '', query: '' };
	}

	var joinPath = this.graph.tableJoins(fromTable, joinTables);
	var joinViews = options.joinViews == true;
	
	var me = this;

	var sqlTables = _.map(joinPath, function(join) {
		return joinViews 
			? me.graph.table(join.join_table).viewName() 
			: join.join_table;
	});

	var sql_clauses = _.map(joinPath, function(join) {
		var idTable = join.id_table;
		var fkTable = join.fk_table;
		if (joinViews) {
			fkTable = me.graph.table(fkTable).viewName();
			idTable = me.graph.table(idTable).viewName();
		}	
		var joinQuery = _.map(join.fk, function(fk) {
			return util.format('%s.id = %s.%s', idTable, fkTable, fk);
		});		
		
		return '(' + joinQuery.join(' OR ') + ')';
	});


	var result = {
		tables: ', ' + sqlTables.join(', '),
		query: ' AND ' + sql_clauses.join(' AND ')
	};
		
	log.debug({result: result}, '...SqlBuilder.joinSQL()');
	return result;

/*
	var result = _.reduce(joinPath, function(memo, join) {

		var joinTable = join.join_table;
		var idTable = join.id_table;
		var fkTable = join.fk_table;

		if (joinViews) {
			joinTable = me.graph.table(joinTable).viewName();
			fkTable = me.graph.table(fkTable).viewName();
			idTable = me.graph.table(idTable).viewName();
		}			

		var fk = join.fk[0]; //TODO

		return memo + util.format(' INNER JOIN %s ON %s.id = %s.%s ',
						joinTable, idTable, fkTable, fk); 
	}, '');
		
//console.log(result);
	return result;
*/
}

SqlBuilder.prototype.filterSQL = function(filterClauses) {

	var me = this;
	var sql_clauses = [];
	var sql_params = [];

	_.each(filterClauses, function(filter) {
		var table = me.graph.table(filter.table);

		assert(table, util.format('filter.table %s unknown', filter.table));
		//if ( ! (filter.op == 'search' && filter.field == '*')) 
		if ( ! (filter.op == 'search' && filter.field == filter.table)) {
			//check field exists		
			table.assertFields([filter.field]);
		}

		var comparatorOperators = {
			'eq' : '=', 
			'ne' : '!=',	
			'ge': '>=', 
			'gt': '>', 
			'le': '<=', 
			'lt': '<'
		};

		if (comparatorOperators[filter.op]) {

			var clause = util.format('(%s."%s" %s ?)', 
							table.viewName(), filter.field, 
							comparatorOperators[filter.op]);

			sql_clauses.push(clause);
			sql_params.push(filter.value);

		} else if (filter.op == 'btwn') {

			var clause = util.format('(%s."%s" BETWEEN ? AND ?)', 
							table.viewName(), filter.field);
				
			assert(filter.value.length && filter.value.length >= 2, 
				util.format("filter.value %s mismatch", filter.value));

			sql_clauses.push(clause);
			sql_params.push(filter.value[0]);
			sql_params.push(filter.value[1]);


		} else if (filter.op == 'in') {

			var inParams = _.times(filter.value.length, function(fn) { 
					return "?"; 
			});

			var clause = util.format('(%s."%s" IN (%s))',
							table.viewName(), filter.field, 
							inParams.join(','));

			assert(filter.value.length, 
				util.format("filter.value %s mismatch", filter.value));

			sql_clauses.push(clause);
			sql_params = sql_params.concat(filter.value); 

		} else if (filter.op == 'search') {

			var clause = util.format('(%s."%s" MATCH ?)', 
							table.ftsName(),
							//check if full row search
							//filter.field == '*'
							filter.field == filter.table
								? table.ftsName()
								: filter.field
						); 	

			sql_clauses.push(clause);

			//(prefix last + phrase query) - see sqlite fts
			var searchValue = '"' + filter.value + '*"';  
			sql_params.push(searchValue);

		} else {
			//unknown op
			throw new Error("unknown filter op '" + filter.op + "'");
		}

	});

	var query = sql_clauses.length > 0 
		? ' AND ' + sql_clauses.join(' AND ')
		: '';

	return { 
		query: query,
		params: sql_params
	};
}

SqlBuilder.prototype.joinSearchSQL = function(filterClauses) {
	//there can be only one search filter
	var searchFilter = _.find(filterClauses, function(filter) {
		return filter.op == 'search';
	});

	if (searchFilter) {
		var table = this.graph.table(searchFilter.table);
		var query = util.format(' AND (%s.docid = %s.id)',
			table.ftsName(),
			table.viewName());

		var result = {
			tables: ', ' + table.ftsName(),
			query: query
		};
		
		return result;

	} else {
		return { tables: '', query: '' };
	}
}

SqlBuilder.prototype.fieldSQL = function(table, fields) {

	if (fields == '*') {
		fields = table.viewFields();
	} else {
		//TODO
		//table.assertFields(fields);
	}

	var result = _.map(fields, function(field) {
		var f = field;
		if (field.indexOf('.') > 0) {
			var t = this.graph.table(field.split('.')[0]);
			var f = field.split('.')[1];
			return util.format('%s."%s" AS %s$%s',
					t.viewName(), f, t.name, f);
		} else {
			return util.format('%s."%s" AS "%s"',
					table.viewName(), field, field);
		}
	}, this);

	return result.join(",");
}

SqlBuilder.prototype.orderSQL = function(table, orderClauses) {

	var orderSQL = '';
	if ( ! _.isEmpty(orderClauses)) {	
		
		orderSQL = _.reduce(orderClauses, function(memo, order, idx) {
			var orderField = _.keys(order)[0];
			var orderDir = _.values(order)[0].toUpperCase();
			
			table.assertFields([orderField]);

			assert(_.contains(['ASC', 'DESC'], orderDir),
				  util.format("order dir '%s' invalid", orderDir));
			
			var result = memo + util.format('"%s" %s', orderField, orderDir);

			if (idx < orderClauses.length-1) result = result + ',';
			return result;
			
		}, 'ORDER BY ');
		
	} 
	return orderSQL;
}

exports.SqlBuilder = SqlBuilder;

