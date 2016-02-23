var graphlib = require('graphlib');
var _ = require('underscore');
var util = require('util');

var graphutil = require('./graph_util.js');

var TableGraph = function(tables) {

	this.graph = new graphlib.Graph({ directed: true });
	this.trees = [];

	var me = this;
	init(tables);

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
				//console.log('fk ' + fkFullName);
				me.graph.setNode(fkFullName);
				me.graph.setEdge(fkFullName, fk.fk_table);
				me.graph.setEdge(table.name, fkFullName);
			});

		});

		/** build table trees **/

		var distinctTrees = {};

		var weightFn = function(e) {
			return 1; 
		}

		var tree = buildTableTree(me.graph, weightFn);

		var hashFn = function(tree) { 
			var keys = _.filter(tree.nodes(), function(v) {
				return ! nodeIsTable(v);
			});
			return keys.sort().join(' '); 
		}

		distinctTrees[hashFn(tree)] = tree;

		var cycles = graphutil.FindAllCycles(me.graph).cycles;
		var cycleKeys = _.uniq(_.filter(_.flatten(cycles), function(v) {
			return ! nodeIsTable(v);
		}));

		//console.log('cycleKeys');
		//console.log(cycleKeys);

		var weightCombinations = powerset(cycleKeys);
		_.each(weightCombinations, function(weights) {
			weightFn = function(e) {
				if (_.contains(weights, e.v)) return 0;
				if (_.contains(weights, e.w)) return 0;
				return 1;
			}

			tree = buildTableTree(me.graph, weightFn);
			distinctTrees[hashFn(tree)] = tree;

		});

		me.trees = _.values(distinctTrees);
	}

}

TableGraph.prototype.tables = function() {
	return _.filter(this.graph.nodes(), function(node) {
		return nodeIsTable(node);
	});
}

TableGraph.prototype.table = function(name) {
	return this.graph.node(name);
}

TableGraph.prototype.tableJoins = function(tables) {
	var joinPaths = _.map(this.trees, function(tree) { 
		return getTableJoins(tree, tables); 
	});

	//filter out invalid join paths (rhs of joinPath has duplicates)
	joinPaths = _.filter(joinPaths, function(joinPath) {
		var idTables = _.map(joinPath, function(p) {
			return p[1];
		});
		return _.uniq(idTables).length == idTables.length;
	});

	var hashFn = function(join) { return _.keys(join).sort().join(' '); }
	var distinctJoins = {};
	 
	_.each(joinPaths, function(joinPath) {
		distinctJoins[hashFn(joinPath)] = joinPath;
	});
	return _.values(distinctJoins);
}

TableGraph.prototype.tableJSON = function(table) {
	table = _.isObject(table) ? table.name : table;
	var json = this.graph.node(table).toJSON();
	json.parents = this.graph.successors(table);
	json.children = this.graph.predecessors(table);
	return json;
}

function nodeIsTable(node) {
	return node.indexOf('.') < 0;
}

function buildTableTree(graph, weightFn) {
	var tree = graphlib.alg.prim(graph, weightFn);

	var keyNodes = _.filter(tree.nodes(), function(v) {
		return ! nodeIsTable(v) && tree.nodeEdges(v).length <= 1;
	});
	_.each(keyNodes, function(v) { tree.removeNode(v); });

	tree = graphutil.DirectTreeEdgesAsGraph(tree, graph);

	return tree;
}


function getTableJoins(spanningTree, tables) {
	//console.log('getTableJoins ' + tables);
	//console.log('tree ' + spanningTree.isDirected());
	var result = {};

	var paths = graphlib.alg.dijkstra(spanningTree, tables[0], 
				function(e) { return 1; },
				function(v) { return spanningTree.nodeEdges(v); } 
	);
	//console.log(paths);

	var join = function(fk, j1, j2) {
		var fkTable = fk.split('.')[0];
		return fkTable == j1 ? [j1, j2] : [j2, j1];
	}

	for(var i = 1; i < tables.length; ++i) {

		var j1 = tables[i];
//console.log('try pred of ' + j1);
		var fk = paths[j1].predecessor;
		var j2 = paths[fk].predecessor;
		result[fk] = join(fk, j1, j2);
		//result[fk] = [j1, j2];

		while(j2 != tables[0]) {
			j1 = j2;
			fk = paths[j1].predecessor;
			j2 = paths[fk].predecessor;
			result[fk] = join(fk, j1, j2);
			//result[fk] = [j1, j2];
		}
	}

	//console.log(result);
	return result;
}

/*
 * from http://rosettacode.org/wiki/Power_set
 */

function powerset(ary) {
    var ps = [[]];
    for (var i=0; i < ary.length; i++) {
        for (var j = 0, len = ps.length; j < len; j++) {
            ps.push(ps[j].concat(ary[i]));
        }
    }
    return ps;
}

exports.TableGraph = TableGraph;

