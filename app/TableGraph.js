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

/*
		_.each(me.trees, function(tree) {
			log.debug(tree.edges());
		});
*/
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

