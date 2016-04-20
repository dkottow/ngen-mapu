var graphlib = require('graphlib');
var _ = require('underscore');
var util = require('util');

var graphutil = require('./graph_util.js');

var log = global.log.child({'mod': 'g6.TableGraph.js'});

	function loadUserTrees() {
log.info('loadUserTrees');
		var trees = [];

		tree = new graphlib.Graph();
		tree.setNode('Position');
		tree.setNode('Player');
		tree.setNode('Team');
		tree.setEdge('Player', 'Position');
		tree.setEdge('Player', 'Team');
		trees.push(tree);

		tree = new graphlib.Graph();
		tree.setNode('Team');
		tree.setNode('Player');
		tree.setNode('Formation');
		tree.setNode('Position');
		tree.setNode('Game');
		tree.setNode('Venue');
		tree.setEdge('Formation', 'Player');
		tree.setEdge('Formation', 'Position');
		tree.setEdge('Formation', 'Game');
		tree.setEdge('Player', 'Team');
		tree.setEdge('Game', 'Venue');
		trees.push(tree);

		return trees;
	}

var TableGraph = function(tables) {

	this.graph = new graphlib.Graph({ directed: true });
	this.trees = [];

	var me = this;
	init(tables);

	function init(tables) {	
		log.debug({tables: _.pluck(tables, 'name')}, 'TableGraph.init()...');

		_.each(tables, function(table) {
			me.graph.setNode(table.name, table);					
		});

		_.each(tables, function(table) {

			var fks = _.where(table.fields, {fk: 1});
			var fkGroups = _.groupBy(fks, 'fk_table');

			_.each(fkGroups, function(fkGroup, fk_table) {
				var fkNames = _.pluck(fkGroup, 'name');
				me.graph.setEdge(table.name, fk_table, fkNames);
			});
		});

		/** build table trees **/
		
		var weightFn = function(e) {
			return 1; 
		}

		var mst = buildTableTree(me.graph, weightFn);
		me.trees = [mst];

		//TODO check if we have user-defined trees
		// eventually replace the mst by them

if (_.find(tables, function(t) { return t.name == 'Formation'; })) {
	me.trees = loadUserTrees();
}

		me.trees.sort(function(tree) { return tree.length; });

		log.debug('...TableGraph.init().');
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
	var dependentTablesFn = function(table) {
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

			var depTables = dependentTablesFn(t);
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
		
		//TODO we cant resolve it
		if ( ! doneInsert) {
			log.error({graph: me.graph}, 
				'TableGraph.dependentTables() failed.');
			throw(new Error('TableGraph Error. Unsupported graph topology.'));

			/*
			log.warn("TabelGraph.tablesByDependency. Found interdependent tables, forcing result"); 
			result.push(remainingTables[0]);
			*/
		}
	}

	return result;
}

TableGraph.prototype.table = function(name) {
	return this.graph.node(name);
}

TableGraph.prototype.tableJoins = function(fromTable, joinTables) {

	log.debug({fromTable: fromTable, joinTables: joinTables},
		"TableGraph.tableJoins()...");

	/* pick first tree having all table nodes to join 
	   we sorted our trees previously by size
	*/
	var tables = [fromTable].concat(joinTables);
	var joinTree = _.find(this.trees, function(tree) {
		for(var i = 0; i < tables.length; ++i) {
			log.trace({
				table: tables[i], 
				found: tree.hasNode(tables[i])
			});
			if ( ! tree.hasNode(tables[i])) return false;
		}
		return true;
	});

	var paths = graphlib.alg.dijkstra(joinTree, fromTable, 
			function(e) { return 1; },
			function(v) { return joinTree.nodeEdges(v); } 
	);
	
	var result = {};
	for(var i = 0; i < joinTables.length; ++i) {
		var path = this.shortestPath(fromTable, joinTables[i], paths);
		_.extend(result, path);
	}
		
	log.debug({path: result}, '...TableGraph.tableJoins()');
	return result;
}

TableGraph.prototype.toJSON = function() {

	var tables = _.map(this.graph.nodes(), function(tn) {
		return this.tableJSON(tn);
	}, this);
	tables = _.object(_.pluck(tables, 'name'), tables);
	
	var trees = _.map(this.trees, function(tree) {
		return this.joinTreeJSON(tree);
	}, this);
	
	return {
		tables: tables,
		join_trees: trees
	}
}

TableGraph.prototype.joinTreeJSON = function(tree) {
	var tables = tree.nodes();
	var joins = _.map(tree.edges(), function(e) { return [e.v, e.w]; });
	return { 
		tables: tables,
		joins: joins
	}
}

TableGraph.prototype.tableJSON = function(table) {
	var me = this;
	var tableName = _.isObject(table) ? table.name : table;

	table = this.graph.node(tableName);
	var json = table.toJSON();

	json.referencing = _.flatten(
		_.map(me.graph.outEdges(tableName), function(e) {
			return _.map(me.graph.edge(e), function(fk) {
				fk = table.fields[fk];
				return { fk: fk.name, fk_table: fk.fk_table };
			});
		})
	);

	json.referenced = _.flatten(
		_.map(me.graph.inEdges(tableName), function(e) {
			return _.map(me.graph.edge(e), function(fk) {
				fk = me.graph.node(e.v).fields[fk];
				return { table: e.v, fk: fk.name };
			});
		})
	);

	return json;
}

TableGraph.prototype.shortestPath = function(fromTable, joinTable, paths) {
	log.trace({
		fromTable: fromTable, 
		joinTable: joinTable,
	}, 'shortestPath...');

	var me = this;
	var joinFn = function(j1, j2) { 
		if (me.graph.edge(j1, j2)) {
			return {
				join_table: j1
				, fk_table: j1
				, id_table: j2
				, fk: me.graph.edge(j1, j2)
			};
		} else if (me.graph.edge(j2, j1)) {
			return {
				join_table: j1
				, fk_table: j2
				, id_table: j1
				, fk: me.graph.edge(j2, j1)
			}; 
		}
		throw new Error('Internal Error. TableGraph.shortestPath() failed.');
	};	

	var result = {};

	var j1 = joinTable;
	var j2 = paths[j1].predecessor;
	result[[j2, j1]] = joinFn(j1, j2);

	while(j2 != fromTable) {
		j1 = j2;
		j2 = paths[j1].predecessor;
		result[[j2, j1]] = joinFn(j1, j2);
	}

	log.trace(result, '...shortestPath');
	return result;
}

function nodeIsTable(node) {
	return node.indexOf('.') < 0;
}

function buildTableTree(graph, weightFn) {
	var tree = graphlib.alg.prim(graph, weightFn);
	tree = graphutil.DirectTreeEdgesAsGraph(tree, graph);
	return tree;
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

