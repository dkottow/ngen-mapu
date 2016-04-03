var graphlib = require('graphlib');
var _ = require('underscore');
var util = require('util');

var graphutil = require('./graph_util.js');

var log = global.log.child({'mod': 'g6.TableGraph.js'});

var TableGraph = function(tables) {

	this.graph = new graphlib.Graph({ directed: true });
	this.trees = [];

	this.tableJoinMap = {};

	var me = this;
	init(tables);

	function init(tables) {	
		log.debug(_.pluck(tables, 'name'), 'init...');

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

		var weightFn = function(e) {
			return 1; 
		}

		var hashFn = function(tree) { 
			var keys = _.filter(tree.nodes(), function(v) {
				return ! nodeIsTable(v);
			});
			return keys.sort().join(' '); 
		}

		var distinctTrees = {};

		var tree = buildTableTree(me.graph, weightFn);
		distinctTrees[hashFn(tree)] = tree;

		var cycles = graphutil.FindAllCycles(me.graph).cycles;
		var cycleKeys = _.uniq(_.filter(_.flatten(cycles), function(v) {
			return ! nodeIsTable(v);
		}));

		log.trace(cycleKeys);
		//console.log('cycleKeys');
		//console.log(cycleKeys);

		var weightCombinations = powerset(cycleKeys);
		//TODO powerset might become quickly very large - take care!

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

		log.debug('tree count = ' + me.trees.length);

		_.each(me.trees, function(tree) {
			log.debug(tree.nodes(), 'tree nodes');
			log.debug(tree.edges(), 'tree edges');
		});
		log.debug('...init');
	}

}

TableGraph.prototype.tables = function() {
	return _.map(_.filter(this.graph.nodes(), function(node) {
			return nodeIsTable(node);
		}), function(name) {
			return this.table(name);
	}, this);
}

TableGraph.prototype.tablesByDependencies = function() {

	var me = this;
	var getDepTables = function(table) {
		return _.map(table.foreignKeys(), function(fk) {
			return me.table(fk.fk_table);
		});
	};

	
	var tables = this.tables();
	var result = [];

	while (result.length < tables.length) {
		var remainingTables = _.difference(tables, result);
		var doneInsert = false;
		_.each(remainingTables, function(t) {

			var depTables = getDepTables(t);
			var pos = 0;
			var doInsert = true;
			for(var i = 0;i < depTables.length; ++i) {
				var p = result.indexOf(depTables[i]);
				if (p < 0) {
					doInsert = false;
					break;
				} else {
					pos = Math.max(p + 1, pos);
				}
			}
			if (doInsert) {
				//console.log('inserting ' + t.name + ' @ ' + pos);
				result.splice(pos, 0, t);
				doneInsert = true;
			}
		});
		
		//TODO if we cant resolve it, push it
		if ( ! doneInsert) {
			log.warn("TabelGraph.tablesByDependency. Found interdependent tables, forcing result"); 
			result.push(remainingTables[0]);
		}
	}

	return result;
}

TableGraph.prototype.table = function(name) {
	return this.graph.node(name);
}

TableGraph.prototype.tableJoins = function(fromTable, joinTables) {

	log.info({fromTable: fromTable, joinTables: joinTables},
		"tableJoins...");
	
	var shortestPathTrees = _.map(this.trees, function(tree) { 

		var paths = graphlib.alg.dijkstra(tree, fromTable, 
				function(e) { return 1; },
				function(v) { return tree.nodeEdges(v); } 
		);

		return {
			tree: tree,
			paths: paths
		}

	});
		
	var joinPaths = _.map(shortestPathTrees, function(paths) {

		var result = {};
		for(var i = 0; i < joinTables.length; ++i) {

			//TODO get join path instead calculating it
			//var r = getJoinPath(fromTable, joinTables[i], paths.tree);

			var r = shortestPath(fromTable, joinTables[i], paths.paths); 

			result = _.extend(result, r);
		}

		log.debug({fromTable: fromTable, path: result});
		return result;
	});

	var distinctJoins = {};
	_.each(joinPaths, function(joinPath) {
		var pathKey = _.keys(joinPath).sort().join(' ');
		distinctJoins[pathKey] = joinPath;
	});

	log.trace(distinctJoins, 'distinctJoins');

	var result = _.values(distinctJoins);

	log.info(result, '...tableJoins');
	return result;
}

TableGraph.prototype.tableJSON = function(table) {
	var tableName = _.isObject(table) ? table.name : table;
	table = this.graph.node(tableName);
	var json = table.toJSON();
	json.referencing = _.map(this.graph.successors(tableName), 
						function(fkFullName) {
		var fk = table.fields[fkFullName.split('.')[1]];
		return { fk: fk.name, fk_table: fk.fk_table };
	});
	json.referenced = _.map(this.graph.predecessors(tableName), 
						function(fkFullName) {
		var fk = fkFullName.split('.');
		return { table: fk[0], fk: fk[1] };
	});
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

function shortestPath(fromTable, joinTable, pathTree) {
	log.debug({
		fromTable: fromTable, 
		joinTable: joinTable,
	}, 'shortestPath...');

	var joinFn = function(fk, j1, j2) {
		var fkTable = fk.split('.')[0];
		var idTable = (fkTable == j1) ? j2 : j1;

		return {
			idTable: idTable,
			fkTable: fkTable,
			joinTable: j1
		}	
	}

	var result = {};

	var j1 = joinTable;
	var fk = pathTree[j1].predecessor;
	var j2 = pathTree[fk].predecessor;
	result[fk] = joinFn(fk, j1, j2);

	while(j2 != fromTable) {
		j1 = j2;
		fk = pathTree[j1].predecessor;
		j2 = pathTree[fk].predecessor;
		result[fk] = joinFn(fk, j1, j2);
	}

	log.debug(result, '...shortestPath');
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

