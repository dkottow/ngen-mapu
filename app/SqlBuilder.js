var _ = require('underscore');
var util = require('util');

var SqlBuilder = function(tableGraph) {
	this.graph = tableGraph;
}

SqlBuilder.prototype.joinSQL = function(tables) {

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
			return memo + util.format(' INNER JOIN %s ON %s = %s.id ',
				ts[1], fk, ts[1])
			}, startTable);
	});
		
	return result;
}

//TODO
SqlBuilder.prototype.filterSQL = function(table, filterClauses) {

	var me = this;
	var joinTables = {};
	var joinSQL = '';
	var whereSQL = " WHERE 1=1";
	var distinct = false;
	var sql_params = [];

	_.each(filterClauses, function(filter) {

		filter.table = filter.table || table.name;

		var allowedFilterFieldNames = (filter.table == table.name) ? 
				table.viewFields() : 
				_.pluck(me.tables[filter.table].fields, 'name');

		allowedFilterFieldNames.push(filter.table);

		assert(_.contains(allowedFilterFieldNames, filter.field), 
			util.format("filter field %s.%s unknown", 
				filter.table, filter.field));

		if (filter.table != table.name) {

			var path = table.bfsPath(me.tables[filter.table]);
			var j = joinTablePath(path, joinTables);
			
			var jSQL = j.sql;
			if (USE_VIEW) {
				var r = new RegExp('\\b' + table.name + '\\b', 'g');
				jSQL = j.sql.replace(r, table.viewName());
			}			

			joinSQL = joinSQL + jSQL;
			distinct = distinct || j.distinct;
			for(var i = 1; i < path.length; ++i) {
				joinTables[path[i].name] = path[i];
			}
		}


		var filterTable = (filter.table == table.name && USE_VIEW) ?
							table.viewName() : filter.table;

		var comparatorOperators = {
			'eq' : '=', 
			'ne' : '!=',	
			'ge': '>=', 
			'gt': '>', 
			'le': '<=', 
			'lt': '<'
		};

		if (comparatorOperators[filter.op]) {

			whereSQL = whereSQL + util.format(" AND %s.%s %s ?", 
									filterTable, filter.field, 
									comparatorOperators[filter.op]
								);
				
			sql_params.push(filter.value);

		} else if (filter.op == 'btwn') {

			whereSQL = whereSQL + util.format(" AND %s.%s BETWEEN ? AND ?", 
									filterTable, filter.field 
								);
				
			assert(filter.value.length && filter.value.length >= 2, 
				util.format("filter.value %s mismatch", filter.value));

			sql_params.push(filter.value[0]);
			sql_params.push(filter.value[1]);


		} else if (filter.op == 'in') {

			var inParams = _.times(filter.value.length, function(fn) { 
					return "?"; 
			});

			whereSQL = whereSQL + util.format(" AND %s.%s IN (%s)",
									filterTable, filter.field,
									inParams.join(',')
								);

			assert(filter.value.length, 
				util.format("filter.value %s mismatch", filter.value));

			sql_params = sql_params.concat(filter.value); 

		} else if (filter.op == 'search') {
			//if ( ! joinTables[me.tables[filter.table].ftsName()]) {
			//dosnt work, you cant search two different criteria
				joinSQL = joinSQL + ' INNER JOIN ' 
					+ me.tables[filter.table].ftsName()
					+ ' ON ' + util.format('%s.docid = %s.id', 
									me.tables[filter.table].ftsName(),
									filterTable);

				joinTables[me.tables[filter.table].ftsName()] 
					= me.tables[filter.table].ftsName(); 
			//}

			whereSQL = whereSQL + util.format(" AND %s.%s MATCH ?", 
									me.tables[filter.table].ftsName(),
									//check if full row search
									filter.field == filter.table ? 
										me.tables[filter.table].ftsName() :
										filter.field
								); 	

			//(prefix last + phrase query) - see sqlite fts
			var searchValue = '"' + filter.value + '*"';  
			sql_params.push(searchValue);

		} else {
			//unknown op
		}

	});

	return { 
		join: joinSQL,
		where: whereSQL,
		distinct: distinct,
		params: sql_params
	};
}

exports.SqlBuilder = SqlBuilder;

