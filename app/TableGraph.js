var graphlib = require('graphlib');
var _ = require('underscore');
var util = require('util');

var graphutil = require('./graph_util.js');

var nodeIsTable = function(node) {
	return node.indexOf('.') < 0;
}

var getTableJoins = function(spanningTree, tables) {
	//console.log('getTableJoins ' + tables);
	//console.log('tree ' + spanningTree.isDirected());
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

	//console.log(result);
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
		var joins = _.map(me.trees, function(tree) { return getTableJoins(tree, tables); });
		var hashFn = function(join) { return _.keys(join).sort().join(' '); }
		var distinctJoins = {};
		
		_.each(joins, function(join) {
			distinctJoins[hashFn(join)] = join;
		});
		return _.values(distinctJoins);
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

		buildAllTrees();
	}

	function buildAllTrees() { 

		var graph = graphlib.json.read(graphlib.json.write(me.graph));

		me.trees = [];

		var weightFn = function(e) { 
			//avoid branching by punishing edge count on nodes 
			console.log('weight ' + e.v + ' ' + e.w + ' = ' +
				( me.graph.nodeEdges(e.v).length 
				+ me.graph.nodeEdges(e.w).length)
			); 
			return me.graph.nodeEdges(e.v).length; 
				+  me.graph.nodeEdges(e.w).length; 
		};


		var weightFn = function(e) {
			console.log('weight ' + e.v + ' ' + e.w +  ' = ' + 
				graph.inEdges(e.w).length);

			return graph.inEdges(e.w).length;
		}

		var mst = graphlib.alg.prim(graph, weightFn);
		//console.log(mst.nodes());
		me.trees.push(mst);

		var paths = graphlib.alg.dijkstraAll(mst,  
					function(e) { return 1; },
					function(v) { return mst.nodeEdges(v); } 
		);

		var cycles = graphutil.FindAllCycles(me.graph).cycles;
		console.log("++ found cycles count " + cycles.length);
		_.each(cycles, function(cycle) {

/*
			var tree = graphlib.json.read(graphlib.json.write(mst));

			for(var i = 1; i < cycle.length; ++i) {
				var edge = mst.edge(cycle[i - 1], cycle[i]);
				if ( ! edge) {
					mst.setEdge(cycle[i - 1], cycle[i]);
				}
			}
*/

			var tables = _.filter(cycle, function(v) { 
				return nodeIsTable(v) && mst.hasNode(v); 
			});
			var t1 = tables[0];
			var t2 = tables[tables.length - 1];
			
			var tree = graphlib.json.read(graphlib.json.write(mst));
			
			while (t1 != t2) {
				console.log('removing ' + paths[t1][t2].predecessor);
				tree.removeNode(paths[t1][t2].predecessor);
				t2 = paths[t1][t2].predecessor;
			}
			//tree.removeNode(t1);

			for(var i = 0; i < cycle.length; ++i) {
				tree.setNode(cycle[i]);
				if (i > 0) tree.setEdge(cycle[i - 1], cycle[i]);
				console.log('adding ' + cycle[i]);
			}
			me.trees.push(tree);
			
		});
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

