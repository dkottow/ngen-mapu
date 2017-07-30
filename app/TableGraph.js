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

//var SqlHelper = require('./SqlHelperFactory.js').SqlHelperFactory.create();
var Table = require('./Table.js').Table;

var log = require('./log.js').log;

var TableGraph = function(tables, options) {

	this.graph = new graphlib.Graph({ directed: true });
	this.trees = [];

	var me = this;
	init(tables, options);
	function init(tables, options) {	
		log.trace('TableGraph.init()...');
		log.trace({tables: _.pluck(tables, 'name'), options: options}, 'TableGraph.init()');

		_.each(tables, function(table) {
			me.graph.setNode(table.name, table);					
		});

		_.each(tables, function(table) {

			var fks = _.where(table.fields(), {fk: 1});
			var fkGroups = _.groupBy(fks, 'fk_table');

			_.each(fkGroups, function(fkGroup, fk_table) {
				var fkNames = _.pluck(fkGroup, 'name');
				log.trace({table: table.name, fk_table: fk_table, fkNames: fkNames}, 'TableGraph.init()');
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
		log.trace({treesCount: me.trees.length}, '...TableGraph.init().');
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
	
	var me = this;
	var weightFn = function(e) {
		return 1; 
	}

	var result = [];

	var components = graphlib.alg.components(this.graph);

	if (components.length == 1) {
		var tree = graphlib.alg.prim(this.graph, weightFn);
		tree = graphutil.DirectTreeEdgesAsGraph(tree, this.graph);
		result.push(tree);

	} else if (components.length > 1) {
		log.debug("Graph is not connected. " + components.length);

		//build trees out of components
		_.each(components, function(nodes) {
			var sg = new graphlib.Graph();
			_.each(nodes, function(n) {
				sg.setNode(n);
				_.each(me.graph.outEdges(n), function(e) {
					sg.setEdge(e);
				});
			});

			var tree = graphlib.alg.prim(sg, weightFn);
			tree = graphutil.DirectTreeEdgesAsGraph(tree, me.graph);
			result.push(tree);
		});
	}
	return result;
}

TableGraph.prototype.tables = function() {
	return _.map(this.graph.nodes(), function(node) {
		return this.table(node);
	}, this);
}

TableGraph.prototype.table = function(name) {
	var table = this.graph.node(name);
	if ( ! table) throw new Error(util.format('table %s not found.', name));
	return table;
}

TableGraph.prototype.parentTables = function(table) {
	if (_.isString(table)) table = this.table(table);
	return _.map(table.foreignKeys(), function(fk) {
		return this.table(fk.fk_table);
	}, this);
}

TableGraph.prototype.childTables = function(table) {
	if (_.isObject(table)) table = table.name;
	var childNodes = this.graph.predecessors(table);
	return _.map(childNodes, function(n) {
		return this.table(n);
	}, this);
}

TableGraph.prototype.tablesByDependencies = function() {

	var tables = this.tables();
	var result = [];

	while (result.length < tables.length) {
		var remainingTables = _.difference(tables, result);
		var doneInsert = false;
		_.each(remainingTables, function(t) {

			var depTables = this.parentTables(t);
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
		}, this);
		
		//TODO we cant resolve it
		if ( ! doneInsert) {
			log.error({graph: me.graph}, 
				'TableGraph.dependentTables() failed.');
			throw(new Error('TableGraph Error. Unsupported graph topology.'));
		}
	}

	return result;
}

TableGraph.prototype.rowsToObj = function(rows, fromTable) {
	var me = this;

	if (rows.length == 0) return { fromTable: [] };

	var fieldQNsByTable = _.groupBy(_.keys(rows[0]), function(fqn) {
		if (fqn.indexOf(Table.TABLE_FIELD_SEPARATOR) > 0) {
			return fqn.split(Table.TABLE_FIELD_SEPARATOR)[0];
		} else {
			return fromTable;
		}
	});

	var tables = _.without(_.keys(fieldQNsByTable), fromTable);
	var joinTree = this.joinTree(fromTable, tables);

	log.trace({
		row0: rows[0]
		, fieldQNsByTable: fieldQNsByTable
		, tables: tables
	}, 'TableGraph.rowsToObj()');

	var objGraph = new graphlib.Graph();
	
	var visited = {};
	var parents = {};
	var queue = [];

	visited[fromTable] = true;
	queue.push(fromTable);
	objGraph.setNode(fromTable);

	while (queue.length > 0) {
		var cur = queue.shift();
		_.each(joinTree.neighbors(cur), function(t) {
			if ( ! _.has(visited, t)) {
				visited[t] = true;
				parents[t] = cur;
				if (_.has(fieldQNsByTable, t)) {
					var pt = parents[t];
					var multi = ! me.graph.edge(pt, t);
					while(pt != fromTable && ! _.has(fieldQNsByTable, pt)) {
						multi = multi ||  (! me.graph.edge(parents[pt], pt));
						pt = parents[pt];
					}
					objGraph.setEdge(t, pt, {multi: multi});
					log.trace({table: t, parentTable: pt, multi: multi}, 
							'TableGraph.rowsToObj() backtracking');
				}
				queue.push(t);
			}
		});
	}

	var rowsToObjsFn = function(rows, tables, parentTable) {
		log.trace({ rows: rows, tables: tables, parent: parentTable}, 'TableGraph.rowsToObj() rowsToObjsFn');

		var fields = [];
		_.each(tables, function(t) {
			fields = fields.concat(fieldQNsByTable[t]);
		});

		var groups = _.groupBy(rows, function(row) {
			return _.reduce(fields, function(memo, f) {
				return memo + row[f];
			}, '');
		});

		var result = {};
		_.each(tables, function(t) {

			var tableFields = _.map(fieldQNsByTable[t], function(fqn) {
				if (fqn.indexOf(Table.TABLE_FIELD_SEPARATOR) > 0) {
					return fqn.split(Table.TABLE_FIELD_SEPARATOR)[1];
				} else {
					return fqn;
				}
			});

			var tableGroups = groups;

			if (tables.length > 1) {
				tableGroups = _.groupBy(rows, function(row) {
					return _.reduce(fieldQNsByTable[t], function(memo, f) {
						return memo + row[f];
					}, '');
				});
			}

			var multi = true;
			if (parentTable) multi = objGraph.edge(t, parentTable).multi;

			var tableAttrs = _.map(tableGroups, function(rows) {
				var attrs = {};
				var attrsCount = fieldQNsByTable[t] 
					? fieldQNsByTable[t].length : 0;
				for(var i = 0; i < attrsCount; ++i) {
					attrs[tableFields[i]] = rows[0][fieldQNsByTable[t][i]];
				}
				return attrs;
			});			

			result[t] = multi ? tableAttrs : tableAttrs[0];

		});

		result.__rows__ = _.map(groups, function(rows) {
			return _.map(rows, function(row) {
				return _.omit(row, fields);
			});
		});

		log.trace({ result: result}, 'rowsToObjs');
		return result;
	}

	/*
     * iterate through all tables in objGraph starting at fromTable. 
	 * processes all childTables with common parent at once
	 * we may visit a table twice, but inf loops are impossible 
	 * since we traverse the (directed) graph only looking at predecessors
     *
     */

	queue = [];

	var result = rowsToObjsFn(rows, [ fromTable ]);
	queue.push({ table: fromTable, obj: result });

	while (queue.length > 0) {
		var item = queue.shift();

		var childTables = objGraph.predecessors(item.table);
		if (childTables.length == 0) continue;
		
		for(var i = 0;i < item.obj.__rows__.length; ++i) {
			//log.trace({item: item, i: i});

			var childObj = rowsToObjsFn(item.obj.__rows__[i], 
							childTables, item.table);

/*
console.log("item i = " + i);
console.log(util.inspect(item));
console.log("**** childObj ***");
console.log(util.inspect(childObj));
*/

			if (item.obj[item.table][i]) {
				//multi
				_.extend(item.obj[item.table][i], childObj);
				delete(item.obj[item.table][i].__rows__);

			} else if (item.obj[item.table]) {
				//single
				_.extend(item.obj[item.table], childObj);
				delete(item.obj[item.table].__rows__);
			}

			_.each(childTables, function(ct) {
				queue.push({ table: ct, obj: childObj });
			});
		}
	}
	delete result.__rows__;
	
	return result;
}

TableGraph.prototype.joinTree = function(fromTable, joinTables) {
	log.trace({fromTable: fromTable, joinTables: joinTables},
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

	log.trace({joinTree: joinTree}, '...TableGraph.joinTree()');
	return joinTree;
}

TableGraph.prototype.tableJoins = function(fromTable, joinTables) {

	log.trace({fromTable: fromTable, joinTables: joinTables},
		"TableGraph.tableJoins()...");

	var joinTree = this.joinTree(fromTable, joinTables);
	if ( ! joinTree) return null;

	var paths = graphlib.alg.dijkstra(joinTree, fromTable, 
			function(e) { return 1; },
			function(v) { return joinTree.nodeEdges(v); } 
	);
	
	var result = {};
	for(var i = 0; i < joinTables.length; ++i) {
		var path = this.shortestPath(fromTable, joinTables[i], paths);
		_.extend(result, path);
	}
		
	log.trace({path: result}, '...TableGraph.tableJoins()');
	return result;
}

TableGraph.prototype.toJSON = function() {

	var tables = _.map(this.graph.nodes(), function(tn) {
				return this.tableJSON(tn);
	}, this);
	
	//sortBy name?
	//tables = _.sortBy(tables, function(t) { return t.name; });
	
	var trees = this.joinTreesJSON();
	
	var result = {
		tables: _.object(_.pluck(tables, 'name'), tables),
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
	var tables = tree.nodes().sort();
	var joins = tree.edges().sort();
	return { 
		tables: tables,
		joins: joins
	}
}

TableGraph.prototype.tableJSON = function(table) {
	log.trace({table: table}, 'TableGraph.tableJSON()');
	var me = this;
	var tableName = _.isObject(table) ? table.name : table;

	table = this.graph.node(tableName);
	var json = table.toJSON();

	json.referencing = _.flatten(
		_.map(me.graph.outEdges(tableName), function(e) {
			return _.map(me.graph.edge(e), function(fk) {
				fk = table.fields()[fk];
				return { fk: fk.name, fk_table: fk.fk_table };
			});
		})
	);

	json.referenced = _.flatten(
		_.map(me.graph.inEdges(tableName), function(e) {
			return _.map(me.graph.edge(e), function(fk) {
				fk = me.graph.node(e.v).fields()[fk];
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

