var _ = require('underscore');
var util = require('util');
var assert = require('assert');

var Field = require('./Field.js').Field;
var Table = require('./Table.js').Table;

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
					+ ' ORDER BY ' + orderSQL
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
	
	//sanitize filterClauses
	_.each(filterClauses, function(fc) {
		if ( ! fc.table) fc.table = table.name;
	});

	var filterTables = _.map(filterClauses, function(fc) {
			return fc.table;
	});

	var joinPaths = this.joinSQL(table.name, filterTables, { joinViews: true });

	var joinSearchSQL = this.joinSearchSQL(filterClauses);
	var filterSQL = this.filterSQL(filterClauses);
	var fieldSQL = this.fieldSQL(table, fields);

	var sql = _.reduce(joinPaths, function(memo, joinSQL) {

		var selectSQL = 'SELECT DISTINCT ' + fieldSQL 
						+ ' FROM ' + table.viewName() 
						+ joinSQL + joinSearchSQL
						+ ' WHERE ' + filterSQL.query; 

		if (memo.length == 0) return selectSQL;
		else return memo + ' UNION ' + selectSQL;
	}, '');

	var totalParams = _.flatten(_.times(joinPaths.length, function(n) {
		return filterSQL.params;
	}), true);

	return {
		'sql': sql, 
		'params': totalParams, 
	};
}

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

	//TODO make sure row_alias only references existing table/fields

	var ref_tables = _.map(_.filter(table.row_alias, function(ref) {
			return ref.indexOf('.') >= 0;		
		}), function(ref) {
		return ref.split('.')[0];	
	});

	var ref_join = this.joinSQL(table.name, ref_tables, { joinViews: true });
	if (ref_join.length > 1) {
		log.warn('No unique join path, taking one of the shortest');
/*
		throw new Error(util.format("Error creating view %s. row_alias [%s] must have a unique join path", table.viewName(), table.row_alias.join(", ")));
*/
	}
	var r = new RegExp('\\b' + table.viewName() + '\\b', 'g');
	ref_join = ref_join[0].replace(r, table.name);;
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
		+ ' FROM ' + table.name + ' ' + ref_join + ' ' + fk_join + ';';

	return sql;
}

SqlBuilder.prototype.joinSQL = function(fromTable, tables, options) {

	options = options || {};

	//var uniqTables = _.uniq([fromTable].concat(tables));
	//if (joinTables.length < 2) return [''];
	var joinTables = _.without(_.uniq(tables), fromTable).sort();
	if (joinTables.length == 0) return [''];

	var joinPaths = this.graph.tableJoins(fromTable, joinTables);
	
	var joinViews = options.joinViews == true;
	
	var me = this;
	var result = _.map(joinPaths, function(joinPath) {

		return _.reduce(joinPath, function(memo, ts, fk) {

			var joinTable = ts.joinTable;
			var idTable = ts.idTable;
			var fkTable = ts.fkTable;

			if (joinViews) {
				joinTable = me.graph.table(joinTable).viewName();
				fkTable = me.graph.table(fkTable).viewName();
				idTable = me.graph.table(idTable).viewName();
			}			

			return memo + util.format(' INNER JOIN %s ON %s.id = %s.%s ',
							joinTable, idTable, fkTable, fk.split('.')[1]); 
		}, '');
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
		//if ( ! (filter.op == 'search' && filter.field == '*')) {
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

	return { 
		query: sql_clauses.join(' AND '),
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

	fields = _.filter(fields, function(fieldName) {
		//viewFields cannot be disabled
		if (_.contains(table.fields, fieldName) && table.field(fieldName).disabled) return false;
		return true;
	});

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

