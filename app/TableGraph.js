var graphlib = require('graphlib');
var _ = require('underscore');
var util = require('util');

var graphutil = require('./graph_util.js');

var nodeIsTable = function(node) {
	return node.indexOf('.') < 0;
}

var getTableJoins = function(spanningTree, tables) {
	console.log('getTableJoins ' + tables);
	var result = {};

	var paths = graphlib.alg.dijkstra(spanningTree, tables[0], 
				function(e) { return 1; },
				function(v) { return spanningTree.nodeEdges(v); } 
	);
	//console.log(paths);

	for(var i = 1; i < tables.length; ++i) {

		var j1 = tables[i];
		var fk = paths[j1].predecessor;
		var j2 = paths[fk].predecessor;
		result[fk] = [j1, j2];

		while(j2 != tables[0]) {
			j1 = j2;
			fk = paths[j1].predecessor;
			j2 = paths[fk].predecessor;
			result[fk] = [j1, j2];
		}
	}

	return result;
}

var TableGraph = function(tables) {
	var me = this;

	me.graph = new graphlib.Graph({ directed: false });

	me.tables = function() {
		return _.filter(me.graph.nodes(), function(node) {
			return nodeIsTable(node);
		});
	}

	me.tableJoins = function(tables) {
		return getTableJoins(me.mst, tables);
	}

	function findAllTrees() { 
		me.trees = [];
		var gc = graphlib.json.read(graphlib.json.write(me.graph));
		var cycles = graphutil.FindAllCycles(gc).cycle;

		_.each(cycles, function(cycle) {

			gc = graphlib.json.read(graphlib.json.write(me.graph));
			_.each(cycles, function(c) {
				if (c != cycle) {
					gc.removeEdge(c[0], c[1]);
					gc.removeEdge(c[1], c[0]);
				}
			});

			var tree = graphlib.alg.prim(gc, function(e) { return 1; });
			me.trees.push(tree);
		});
	}

	function init(tables) {	

		_.each(tables, function(table) {
			me.graph.setNode(table.name, table);					
		});

		_.each(tables, function(table) {
			var fks = _.filter(table.fields, function(f) {
				return f.fk == 1;
			});

			_.each(fks, function(fk) {			
				var fkFullName = table.name + "." + fk.name;
				me.graph.setNode(fkFullName);
				me.graph.setEdge(fkFullName, fk.fk_table);
				me.graph.setEdge(table.name, fkFullName);
			});

		});

		//findAllTrees();

		me.mst = graphlib.alg.prim(me.graph, function(e) { return 1; });
		me.cycles = graphutil.FindAllCycles(me.graph).cycles;

		

/*
		me.shortestPaths = graphlib.alg.dijkstraAll(me.graph, 
					function(e) { return 1; }, 
					function(v) { return me.graph.nodeEdges(v); } 
		);
*/
	}

	init(tables);
}

TableGraph.prototype.tableJSON = function(table) {
	table = _.isObject(table) ? table.name : table;
	var json = this.graph.node(table).toJSON();
	json.parents = this.graph.successors(table);
	json.children = this.graph.predecessors(table);
	return json;
}

exports.TableGraph = TableGraph;

