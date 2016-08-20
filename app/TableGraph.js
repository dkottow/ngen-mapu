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
var Table = require('./Table.js').Table;

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

TableGraph.prototype.rowsToObj = function(rows, fromTable) {
	if (rows.length == 0) return { fromTable: [] };

	var fieldsByTable = _.groupBy(_.keys(rows[0]), function(fqn) {
		if (fqn.indexOf(Table.TABLE_FIELD_SEPARATOR) > 0) {
			return fqn.split(Table.TABLE_FIELD_SEPARATOR)[0];
		} else {
			return fromTable;
		}
	});

	var rowsToObjs = function(rows, tables) {
		console.log('rowsToObj ' + tables);
		console.log('**** rows ****');
//		console.log(rows);

		var fields = [];
		_.each(tables, function(t) {
			fields = fields.concat(fieldsByTable[t]);
		});

		var groups = _.groupBy(rows, function(row) {
			return _.reduce(fields, function(memo, f) {
				return memo + row[f];
			}, '');
		});

		var result = {};
		_.each(tables, function(t) {
			result[t] = _.map(groups, function(rows) {
				var attrs = {};
				_.each(fieldsByTable[t], function(fqn) {
					var f = fqn;
					if (fqn.indexOf(Table.TABLE_FIELD_SEPARATOR) > 0) {
						f = fqn.split(Table.TABLE_FIELD_SEPARATOR)[1];
					}
					attrs[f] = rows[0][fqn];
				});
				return attrs;
			});			
		});
		result.__rows__ = _.map(groups, function(rows) {
			return _.map(rows, function(row) {
				return _.omit(row, fields);
			});
		});
/*
		var result = _.map(groups, function(rows) {
			var obj = {};
			_.each(tables, function(t) {
				var attrs = {};
				_.each(fieldsByTable[t], function(fqn) {
					var f = fqn;
					if (fqn.indexOf(Table.TABLE_FIELD_SEPARATOR) > 0) {
						f = fqn.split(Table.TABLE_FIELD_SEPARATOR)[1];
					}
					attrs[f] = rows[0][fqn];
				});
				obj[t] = attrs;
			});			
			obj.__rows__ = _.map(rows, function(row) {
				return _.omit(row, fields);
			});
			return obj;
		});
*/
console.log('**** result ****');
//console.log(result);
		return result;
	}

	var tables = _.without(_.keys(fieldsByTable), fromTable);
	var joinTree = this.joinTree(fromTable, tables);

	//var objs = rowsToObjs(rows, fromTable, { stripQ: false });
	//addObjs(objs, fromTable);

	
	var visited = {};
	var parents = {};
	var queue = [];

	visited[fromTable] = true;
	queue.push(fromTable);


	while (queue.length > 0) {
		var cur = queue.shift();
		_.each(joinTree.neighbors(cur), function(t) {
			if ( ! _.has(visited, t)) {
				visited[t] = true;
				parents[t] = cur;
				if (_.has(fieldsByTable, t)) {
					var pt = parents[t];
					while(pt != fromTable && ! _.has(fieldsByTable, pt)) {
						pt = parents[pt];
					}
					console.log('backtracking from ' + t + ' to ' + pt);
				}
				queue.push(t);
			}
		});
	}

	var result = rowsToObjs(rows, ['customers']);
	console.log('no of customers ' + result.customers.length);

	var orders = rowsToObjs(result.__rows__[0], ['orders']);
	_.extend(result.customers[0], orders);

	var sandwiches = rowsToObjs(orders.__rows__[0], ['sandwiches']);
	_.extend(result.customers[0].orders[0], sandwiches);

	delete(result.__rows__);
	delete(result.customers[0].__rows__);
	delete(result.customers[0].orders[0].__rows__);

	console.log('result');
	console.log(result);
	console.log('result.customers[0]');
	console.log(result.customers[0]);
	console.log('result.customers[0].orders[0]');
	console.log(result.customers[0].orders[0]);

	return result;
}


/*
	var result = rowsToObjFn(rows, fromTable);
	
	var tables = _.without(_.keys(fieldsByTable), fromTable);
	console.log(tables);


	var paths = graphlib.alg.dijkstra(joinTree, fromTable, 
			function(e) { return 1; },
			function(v) { return joinTree.nodeEdges(v); } 
	);

	var parentTables = {};

	for(var i = 0; i < tables.length; ++i) {

		//iterate on path from tables[i] to fromTable
		var j1 = tables[i];
		var j2 = paths[j1].predecessor;
		var many = !! this.graph.edge(j1, j2);
		while(j2 != fromTable) {
			j1 = j2;
			j2 = paths[j1].predecessor;
			if (this.graph.edge(j1, j2)) many = true;

			//if path table j2 is part of tables, make j2 the parent
			if (_.contains(_.without(tables, tables[i]), j2)) {
				parentTables[tables[i]] = { 
					child: tables[i],
					parent: j2,
					many: many
				};
				break;
			}
		}
		//if no table on path make fromTable the parent
		if (j2 == fromTable) {
			parentTables[tables[i]] = {
				child: tables[i],
				parent: fromTable,
				many: many
			};
		}
	}

	console.log(parentTables);

	var parentTable = fromTable;
	while(tables.length > 0) {

		//process all immediate children of parentTable
		var children = _.filter(parentTables, function(r) {
			return r.parent == parentTable;
		});

		//TODO general case how to get cur 
		var cur = result[parentTable];
		_.each(children, function(r) {
			for(var i = 0;i < cur.length; ++i) {
				var childRows = rowsToObjFn(
						cur[i].__rows__
						, r.child
						, { stripQ: true }
				);
				if (r.many) {
					cur[i][r.child] = childRows[r.child];	
				} else {
					cur[i][r.child] = childRows[r.child][0];	
				}
				//delete cur[i].__rows__;
			}
		});

		children = _.pluck(children, 'child');

		tables = _.difference(tables, children);
		//console.log(tables);
		tables = [];

		//TODO initialize parentTable

	}
*/


/*
	//process all immediate children of fromTable
	var fromChildren = _.filter(parentTables, function(r) {
		return r.parent == fromTable;
	});

	var cur = result[fromTable];
	_.each(fromChildren, function(r) {
		for(var i = 0;i < cur.length; ++i) {
			var childRows = rowsToObjFn(
					cur[i].__rows__
					, r.child
					, { stripQ: true }
			);
			cur[i][r.child] = childRows[r.child];	
			delete cur[i].__rows__;
		}
	});
*/

/* iterate over tables: it
		get path fromTable - it
		add it rows to closest table on path, usually just fromTable
		distinguish between referenced (add array) and referencing (single obj)
*/

//to add all orders rows we need iteration over customers
/*
var r2 = rowsToObjFn(result.customers[0].__rows__, 'orders', { stripQ: true });
console.log(r2);
*/

TableGraph.prototype.joinTree = function(fromTable, joinTables) {
	log.debug({fromTable: fromTable, joinTables: joinTables},
		"TableGraph.joinTree()...");

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

	log.debug({joinTree: joinTree}, '...TableGraph.joinTree()');
	return joinTree;
}

TableGraph.prototype.tableJoins = function(fromTable, joinTables) {

	log.debug({fromTable: fromTable, joinTables: joinTables},
		"TableGraph.tableJoins()...");

	var joinTree = this.joinTree(fromTable, joinTables);

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

