var _ = require('underscore');
var util = require('util');
var assert = require('assert');

var SqlBuilder = function(tableGraph) {
	this.graph = tableGraph;
}

SqlBuilder.prototype.selectSQL 
	= function(table, fields, filterClauses, orderClauses, limit, offset) 
{
	assert(_.isObject(table), "arg 'table' is object");
	assert(fields == '*' || _.isArray(fields), "arg 'fields' is '*' or array");
	assert(_.isArray(filterClauses), "arg 'filterClauses' is array");
	assert(_.isArray(orderClauses), "arg 'orderClauses' is array");
	
	assert(_.isNumber(limit), "arg limit must be integer");
	assert(_.isNumber(offset), "arg offset must be integer");

	//sanitize filterClauses
	_.each(filterClauses, function(fc) {
		if ( ! fc.table) fc.table = table.name;
	});

	var tables = _.uniq([table.name].concat(
		_.map(filterClauses, function(fc) {
			return fc.table;
	})));

	var tableJoinPaths = tables.length == 1
		? [ table.viewName() ] 
		: this.joinSQL(tables);

	var filterSQL = this.filterSQL(filterClauses);
	var filterJoinSQL = this.filterJoinSQL(filterClauses);
	var orderSQL = this.orderSQL(table, orderClauses);
	var fieldSQL = this.fieldSQL(table, fields);

	var sql = _.reduce(tableJoinPaths, function(memo, tableSQL) {

		var selectSQL = 'SELECT DISTINCT ' + fieldSQL 
						+ ' FROM ' + tableSQL + filterJoinSQL
						+ ' WHERE ' + filterSQL.query; 

		if (memo.length == 0) return selectSQL;
		else return memo + ' UNION ' + selectSQL;
	}, '');

	var countSQL = 'SELECT COUNT(*) as count FROM (' + sql + ')';

	var selectSQL = 'SELECT * FROM (' + sql + ')'
					+ ' ORDER BY ' + orderSQL
					+ ' LIMIT ' + limit
					+ ' OFFSET ' + offset;

	var totalParams = _.flatten(_.times(tableJoinPaths.length, function(n) {
		return filterSQL.params;
	}), true);
	
/*
	log.debug(selectSQL);
	log.debug(totalParams);
	log.debug(countSQL);
*/

	return {
		'query': selectSQL, 
		'params': totalParams, 
		'countSql': countSQL
	};
}

//TODO - merge with selectSQL
SqlBuilder.prototype.statsSQL = function(table, fields, filterClauses) 
{
	assert(_.isObject(table), "arg 'table' is object");
	assert(fields == '*' || _.isArray(fields), "arg 'fields' is '*' or array");
	assert(_.isArray(filterClauses), "arg 'filterClauses' is array");
	
	var joinTables = {};
	joinTables[table.name] = table.name;
	_.each(filterClauses, function(fc) {
		if ( ! fc.table) fc.table = table.name;
		joinTables[fc.table] = fc.table;
	});

	var joins = this.joinSQL(_.keys(joinTables));
	var filterSQL = this.filterSQL(filterClauses);
	var filterJoinSQL = this.filterJoinSQL(filterClauses);
	var fieldSQL = this.fieldSQL(table, fields);

/* TODO take out
	var sql = _.reduce(joins, function(memo, joinSQL) {

		var selectSQL = 'SELECT DISTINCT ' + fieldSQL 
						+ ' FROM ' + joinSQL + filterJoinSQL
						+ ' WHERE ' + filterSQL.query; 

		if (memo.length == 0) return selectSQL;
		else return memo + ' UNION ' + selectSQL;
	}, '');
*/

/* TODO implement
			var sql_query = _.reduce(resultFields, function(memo, f) {

				var s = util.format("SELECT '%s' as field, "
							+ "min(%s.%s) as min, max(%s.%s) as max "
							+ " FROM %s", 
								f, 
								table.viewName(), f, 
								table.viewName(), f, 
								table.viewName());

				s += filterJoinSQL 
					+ ' WHERE ' + filterSQL.query;

				return (memo.length == 0) ?  s : memo + ' UNION ALL ' + s;
			}, '');

			var sql_params = [];
			_.each(resultFields, function() {
				sql_params = sql_params.concat(filterSQL.params);
			});

			log.debug(sql_query);
			log.debug(sql_params);
*/

	var totalParams = _.flatten(_.times(joins.length, function(n) {
		return filterSQL.params;
	}), true);
	
/*
	log.debug(selectSQL);
	log.debug(totalParams);
	log.debug(countSQL);
*/

	return {
		'query': selectSQL, 
		'params': totalParams, 
		'countSql': countSQL
	};
}

SqlBuilder.prototype.createSQL = function() {
	var createSysTablesSQL = Table.CreateTableSQL
					+ Field.CreateTableSQL;

	var sysTablesInsertSQL = _.map(this.graph.tables(), function(t) {
		return t.insertPropSQL();
	}).join('\n');

	var tables = this.graph.tablesByDependencies();

	var createTableSQL = _.map(tables, function(t) {
		return t.createSQL();
	}).join('\n');

	var createViewSQL = _.map(tables, function(t) {
		return this.createViewSQL(t);
	}, this).join('\n');


	var sql = createSysTablesSQL + '\n\n'
			+ sysTablesInsertSQL + '\n\n'
			+ createTableSQL + '\n\n'
			+ createViewSQL + '\n\n';
	
	log.debug(sql);
	return sql;
}

// private methods...


/*
function srns(pre, n) {
	//small random nmuber string
	return Math.random().toString(n,n);
}
*/

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

	var fk_join = _.reduce(table.foreignKeys(), function(memo, fk) {
		var fk_table = me.graph.table(fk.fk_table);
		return memo + util.format(' INNER JOIN %s AS %s ON %s."%s" = %s.id ',
			fk_table.viewName(), aliasFn(fk),
			table.name, fk.name,
			aliasFn(fk));	
	}, '');

	var ref_tables = _.uniq(_.map(_.filter(table.row_alias, function(ref) {
			return ref.indexOf('.') >= 0;		
		}), function(ref) {
		return ref.split('.')[0];	
	}));

	var ref_join = table.name;
	if (ref_tables.length > 0) {
		ref_join = this.joinSQL([table.name].concat(ref_tables));

		if (ref_join.length > 1) {
			throw new Error(util.format("Error creating view %s. row_alias [%s] must have a unique join path"), table.viewName(), table.row_alias.join(", "));
		}

		var r = new RegExp('\\b' + table.viewName() + '\\b', 'g');
		ref_join = ref_join[0].replace(r, table.name);
	}

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

	var ref_id =  util.format("'(' || %s.id || ')' AS %s", 
		table.name,
		Field.REF_NAME
	);
	
	ref_field = ref_field.length > 0
		? "COALESCE(" + ref_field + ", '') || " + ref_id 
		: ref_id;

	var table_fields = _.map(table.fields, function(f) {
		return util.format('%s."%s" AS "%s"', table.name, f.name, f.name);
	});

	var fields = [ref_field].concat(table_fields).concat(fk_fields);

	var sql = 'CREATE VIEW ' + table.viewName() + ' AS '
		+ ' SELECT ' + fields.join(', ')
		+ ' FROM ' + ref_join + ' ' + fk_join + ';';

	return sql;
}

SqlBuilder.prototype.joinSQL = function(tables) {

	assert(tables.length > 1);

	var me = this;
	var joinPaths = this.graph.tableJoins(tables);
	
	var result = _.map(joinPaths, function(joinPath) {

		var fkTables = _.map(joinPath, function(p) {
			return p[0];
		});

		var idTables = _.map(joinPath, function(p) {
			return p[1];
		});

		var startTable = _.find(fkTables, function(t) {
			return ! _.contains(idTables, t)
		});

		return _.reduce(joinPath, function(memo, ts, fk) {
			var t1 = me.graph.table(ts[0]);
			var t2 = me.graph.table(ts[1]);
			return memo + util.format(' INNER JOIN %s ON %s.id = %s.%s ',
							t2.viewName(), 
							t2.viewName(),
							t1.viewName(), fk.split('.')[1]); 
		}, me.graph.table(startTable).viewName());
	});
		
	return result;
}

SqlBuilder.prototype.filterSQL = function(filterClauses) {

	var me = this;
	var sql_clauses = ["1=1"];
	var sql_params = [];

	_.each(filterClauses, function(filter) {
		var table = me.graph.table(filter.table);

		assert(table, util.format('filter.table %s unknown', filter.table));
		if ( ! (filter.op == 'search' && filter.field == '*')) {
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

			var clause = util.format('%s."%s" %s ?', 
							table.viewName(), filter.field, 
							comparatorOperators[filter.op]);

			sql_clauses.push(clause);
			sql_params.push(filter.value);

		} else if (filter.op == 'btwn') {

			var clause = util.format('%s."%s" BETWEEN ? AND ?', 
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

			var clause = util.format('%s."%s" IN (%s)',
							table.viewName(), filter.field, 
							inParams.join(','));

			assert(filter.value.length, 
				util.format("filter.value %s mismatch", filter.value));

			sql_clauses.push(clause);
			sql_params = sql_params.concat(filter.value); 

		} else if (filter.op == 'search') {

			var clause = util.format('%s."%s" MATCH ?', 
							table.ftsName(),
							//check if full row search
							filter.field == '*'
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

	return { 
		query: sql_clauses.join(' AND '),
		params: sql_params
	};
}

SqlBuilder.prototype.filterJoinSQL = function(filterClauses) {
	//there can be only one search filter
	var searchFilter = _.find(filterClauses, function(filter) {
		return filter.op == 'search';
	});

	if (searchFilter) {
		var table = this.graph.table(searchFilter.table);
		return util.format(' INNER JOIN %s ON %s.docid = %s.id',
				table.ftsName(),
				table.ftsName(),
				table.viewName());
	} else {
		return '';
	}
}

SqlBuilder.prototype.fieldSQL = function(table, fields) {

	if (fields == '*') {
		fields = table.viewFields();
	} else {
		table.assertFields(fields);
	}

	fields = _.map(fields, function(fieldName) {
		return util.format('%s."%s" AS "%s"', table.viewName(), fieldName, 
			fieldName);
	});

	return fields.join(",");
}

SqlBuilder.prototype.orderSQL = function(table, orderClauses) {

	var orderSQL;
	if ( ! _.isEmpty(orderClauses)) {	
		
		var orderSQL = _.reduce(orderClauses, function(memo, order, idx) {
			var orderField = _.keys(order)[0];
			var orderDir = _.values(order)[0].toUpperCase();
			
			table.assertFields([orderField]);

			assert(_.contains(['ASC', 'DESC'], orderDir),
				  util.format("order dir '%s' invalid", orderDir));
			
			var result = memo + util.format('"%s" %s', orderField, orderDir);

			if (idx < orderClauses.length-1) result = result + ',';
			return result;
			
		}, '');
		
	} else {
		//most recently created first
		orderSQL = 'id DESC';
	}
	return orderSQL;
}

exports.SqlBuilder = SqlBuilder;

