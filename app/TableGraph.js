/*
   Copyright 2016 Daniel Kottow

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
*/

var graphlib = require('graphlib');
var _ = require('underscore');
var util = require('util');

var graphutil = require('./graph_util.js');

var log = global.log.child({'mod': 'g6.TableGraph.js'});

var TableGraph = function(tables, options) {

	this.graph = new graphlib.Graph({ directed: true });
	this.trees = [];

	var me = this;
	init(tables, options);

	function init(tables, options) {	
		log.debug('TableGraph.init()...');
		log.trace({tables: _.pluck(tables, 'name'), options: options});

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
		if (options.join_trees && options.join_trees.length > 0) {
			me.trees = me.initJoinTrees(options.join_trees);
		} else {
			me.trees = me.minimumSpanningTree();
		}

/*
if (_.find(tables, function(t) { return t.name == 'Formation'; })) {
	me.trees = loadUserTrees();
}
*/
		log.trace({trees: me.trees}, 'TableGraph.init()');
		log.debug('...TableGraph.init().');
	}

}

TableGraph.prototype.initJoinTrees = function(trees) {
	return _.map(trees, function(tree) {
		var g = new graphlib.Graph();
		_.each(tree.table, function(t) { g.setNode(t); });
		_.each(tree.joins, function(j) { g.setEdge(j.v, j.w); });
		return g;
	});
}

TableGraph.prototype.minimumSpanningTree = function() {
	var weightFn = function(e) {
		return 1; 
	}

	var components = graphlib.alg.components(this.graph);

	if (components.length == 1) {
		var tree = graphlib.alg.prim(this.graph, weightFn);
		tree = graphutil.DirectTreeEdgesAsGraph(tree, this.graph);
		return [ tree ];

	} else {
		//TODO build trees out of components
		log.warn("Graph is not connected. " + components.length);
		return [];
	}
}

TableGraph.prototype.tables = function() {
	return _.map(this.graph.nodes(), function(node) {
		return this.table(node);
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

TableGraph.prototype.assertTable = function(name) {
	this.table(name);
}

TableGraph.prototype.table = function(name) {
	var table = this.graph.node(name);
	if ( ! table) throw new Error(util.format('table %s not found.', name));
	return table;
}

TableGraph.prototype.tableJoins = function(fromTable, joinTables) {

	log.debug({fromTable: fromTable, joinTables: joinTables},
		"TableGraph.tableJoins()...");

	/* pick first tree that covers all tables 
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
	
	var trees = this.joinTreesJSON();
	
	var result = {
		tables: tables,
		join_trees: trees
	};
	log.trace({result: result}, 'TableGraph.toJSON()');
	return result;
}

TableGraph.prototype.joinTreesJSON = function() {
	return _.map(this.trees, function(tree) {
		return this.joinTreeJSON(tree);
	}, this);
}

TableGraph.prototype.joinTreeJSON = function(tree) {
	log.trace({tree: tree}, 'TableGraph.joinTreeJSON()');
	var tables = tree.nodes();
	var joins = tree.edges();
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

