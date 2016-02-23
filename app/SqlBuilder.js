var _ = require('underscore');
var util = require('util');
var assert = require('assert');

var SqlBuilder = function(tableGraph) {
	this.graph = tableGraph;
}

SqlBuilder.prototype.joinSQL = function(tables) {

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

//TODO
SqlBuilder.prototype.filterSQL = function(filterClauses) {

	var me = this;
	var sql_clauses = [];
	var sql_params = [];

	_.each(filterClauses, function(filter) {
		var table = me.graph.table(filter.table);

		assert(table, util.format('filter.table %s unknown', filter.table));
		if ( ! (filter.op == 'search' && filter.field.length == 0)) {
			//filter field may be empty if filter.op is search		
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

			var clause = util.format("%s.%s %s ?", 
							table.viewName(), filter.field, 
							comparatorOperators[filter.op]);

			sql_clauses.push(clause);
			sql_params.push(filter.value);

		} else if (filter.op == 'btwn') {

			var clause = util.format("%s.%s BETWEEN ? AND ?", 
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

			var clause = util.format("%s.%s IN (%s)",
							table.viewName(), filter.field, 
							inParams.join(','));

			assert(filter.value.length, 
				util.format("filter.value %s mismatch", filter.value));

			sql_clauses.push(clause);
			sql_params = sql_params.concat(filter.value); 

		} else if (filter.op == 'search') {

/*
//TODO move this join to another place (selectSQL)

				joinSQL = joinSQL + ' INNER JOIN ' 
					+ me.tables[filter.table].ftsName()
					+ ' ON ' + util.format('%s.docid = %s.id', 
									me.tables[filter.table].ftsName(),
									filterTable);

				joinTables[me.tables[filter.table].ftsName()] 
					= me.tables[filter.table].ftsName(); 
*/

			var clause = util.format("%s.%s MATCH ?", 
							table.ftsName(),
							//check if full row search
							filter.field.length == 0
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

SqlBuilder.prototype.fieldSQL = function(table, fields) {

	if (fields == '*') {
		fields = table.viewFields();
	} else {
		table.assertFields(fields);
	}

	fields = _.map(fields, function(fieldName) {
		return util.format('%s."%s" as %s', table.viewName(), fieldName, 
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


SqlBuilder.prototype.selectSQL = function(table, fields, 
		filterClauses, orderClauses, limit, offset) {

	assert(_.isObject(table), "arg 'table' is object");
	assert(fields == '*' || _.isArray(fields), "arg 'fields' is '*' or array");
	assert(_.isArray(filterClauses), "arg 'filterClauses' is array");
	assert(_.isArray(orderClauses), "arg 'orderClauses' is array");
	
	assert(_.isNumber(limit), "arg limit must be integer");
	assert(_.isNumber(offset), "arg offset must be integer");

	var joinTables = {};
	joinTables[table.name] = table;
	_.each(filterClauses, function(fc) {
		if ( ! fc.table) fc.table = table.name;
		joinTables[fc.table] = fc.table;
	});

	var joins = this.joinSQL(_.keys(joinTables));
	var filterSQL = this.filterSQL(filterClauses);
	var orderSQL = this.orderSQL(table, orderClauses);
	var fieldSQL = this.fieldSQL(table, fields);

	var sql = _.reduce(joins, function(memo, joinSQL) {

		var selectSQL = 'SELECT DISTINCT ' + fieldSQL 
						+ ' FROM ' + joinSQL 
						+ ' WHERE ' + filterSQL.query; 

		if (memo.length == 0) return selectSQL;
		else return memo + ' UNION ' + selectSQL;
	}, '');

	var countSQL = 'SELECT COUNT(*) as count FROM (' + sql + ')';

	var selectSQL = 'SELECT * FROM (' + sql + ')'
					+ ' ORDER BY ' + orderSQL
					+ ' LIMIT ' + limit
					+ ' OFFSET ' + offset;

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

exports.SqlBuilder = SqlBuilder;

