var graphlib = require('graphlib');
var _ = require('underscore');
var util = require('util');


var TableGraph = function(tables) {
	var me = this;

	me.aliasCounts = {};
	var newAlias = function(tableName) {
		me.aliasCounts[tableName] = me.aliasCounts[tableName] 
			?  me.aliasCounts[tableName] + 1 : 2;
		return tableName + '_' + me.aliasCounts[tableName];
	}

	me.graph = new graphlib.Graph();
	
	_.each(tables, function(table) {
		me.graph.setNode(table.name, table);		
	});

	_.each(tables, function(table) {
		var fks = _.filter(table.fields, function(f) {
			return f.fk == 1;
		});

		var fkTables = {};

		_.each(fks, function(fk) {			
			var edge = { 
				fk_table: fk.fk_table, 
				fk: fk.name, 
				table: table.name 
			}
console.log(edge);
			if (fk.fk_table == table.name 
				|| me.graph.edge(table.name, fk.fk_table)) {
				//me.graph.setNode(alias, me.graph.node(fk.fk_table));
				var curr = me.graph.edge(table.name, fk.fk_table);
				var joins = _.isArray(curr) ? curr : [ curr ];
				joins.push(edge);
				me.graph.setEdge(table.name, fk.fk_table, joins);

			} else {
				me.graph.setEdge(table.name, fk.fk_table, edge);
			}
			fkTables[fk.fk_table] = 1;
		});
	});


	me.paths = graphlib.alg.dijkstraAll(me.graph, 
					function(e) { return 1; }, 
					function(v) { return me.graph.nodeEdges(v); } 
	);
	//console.log(me.paths);
}

TableGraph.prototype.path = function(fromTable, toTable) {
	console.log('path ' + fromTable + " to " + toTable);
	var distinct = false;
	var edges = [];
	var prev = fromTable;
	var path = this.paths[toTable][fromTable];
	var curr = path.predecessor;
	while (path.distance > 0) {
		//console.log(prev, curr);
		var e = _.clone(this.graph.edge(curr, prev));		
		if (e == undefined) {
			e = _.clone(this.graph.edge(prev, curr));
			e.join_table = e.fk_table;
			distinct = true;	
			//console.log(curr, prev, distinct);
		} else {
			e.join_table = e.table;
		}
		edges.push(e);
		prev = curr;
		path = this.paths[toTable][curr];
		curr = path.predecessor;		
	}
	return { joins: edges, distinct: distinct };
}

TableGraph.prototype.tableJSON = function(tableName) {
	var json = this.graph.node(tableName).toJSON();
	json.parents = this.graph.successors(tableName);
	json.children = this.graph.predecessors(tableName);
	return json;
}

TableGraph.prototype.toSQL = function(joins) {	
	var result = {};
	var combinedJoins;
	if (_.isArray(joins)) {
		var allJoins = _.flatten(_.pluck(joins, 'joins'));
		combinedJoins = _.uniq(allJoins, false, function(j) {
			return j.join_table;
		});
		result.distinct = _.reduce(_.pluck(joins, 'distinct'), 
			function(r, d) { 
				return r || d; }, false);

	} else {
		combinedJoins = joins.joins;
		result.distinct = joins.distinct;
	}
	var sql = _.reduce(combinedJoins, function(sql, join) {
		return sql 
			+ ' INNER JOIN ' + join.join_table 
			+ ' ON ' + util.format('%s.%s = %s.id', 
							join.table, join.fk, join.fk_table);
	}, ''); //dont start with first table
	result.sql = sql;
	return result;
}

exports.TableGraph = TableGraph;

