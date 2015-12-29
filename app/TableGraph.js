var graphlib = require('graphlib');
var _ = require('underscore');
var util = require('util');


var TableGraph = function(tables) {
	var me = this;

	me.graph = new graphlib.Graph();
	me.paths = {};
	

	me.tables = function() {
		return _.filter(me.graph.nodes(), function(node) {
			return node.indexOf('.') < 0;
		});
	}

	me.joinPaths = function(tables) {
		
		// 1. generate a good start path by choosing maximally distant nodes
		var maxDistance = -1;
		var maxPath;
		_.each(tables, function(t1) {
			_.each(tables, function(t2) {
				var p = me.shortestPaths[t1][t2];
				if (p.distance > maxDistance) {
					maxDistance = p.distance;
					maxPath = [t1, t2];
				}
			});
		});

		// 2. get all paths between distant nodes
		var paths = me.paths[maxPath[0]][maxPath[1]];

		// 3. make sure all tables are in all paths, add when necessary.
		_.each(paths, function(path) {
			_.each(tables, function(table) {
				if ( ! _.contains(path, table)) {
					//choose tail or head of path to extend
					var head = _.first(path);					
					var tail = _.last(path);					

					if (me.shortestPaths[table][head].distance 
					  < me.shortestPaths[tail][table].distance) {
						
						//TODO add shortest path (only missing joins?) to it
						console.log('add head ' + table + " - " + head);
					} else {
						console.log('add tail ' + tail + " - " + table);
					}
				}
			});
		});

		console.log(paths);
		console.log(me.shortestPaths['athletes']['persons']);
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

		var allPaths = {};
		var tableNodes = me.tables();
		_.each(tableNodes, function(n1) {
			allPaths[n1] = {};
			_.each(tableNodes, function(n2) {
				allPaths[n1][n2] = [];
				if (n1 != n2) {
					var result = GetAllPaths(me.graph, n1, n2);
					allPaths[n1][n2] = result.paths;
				} else {
					//todo handle self refs
				}
			});
		});
		me.paths = allPaths;

		me.shortestPaths = graphlib.alg.dijkstraAll(me.graph, 
					function(e) { return 1; }, 
					function(v) { return me.graph.nodeEdges(v); } 
		);

	}

	init(tables);
}

function r4() {
	return Math.random().toString().substr(4,4);
}

TableGraph.prototype.tableJSON = function(table) {
	table = _.isObject(table) ? table.name : table;
	var json = this.graph.node(table).toJSON();
	json.parents = this.graph.successors(table);
	json.children = this.graph.predecessors(table);
	return json;
}

function GetAllPaths(graph, start, end)
{
	if ( ! graph.hasNode(start) || ! graph.hasNode(end))
		throw new Error('start or end node not in graph');

	this.paths = [];
	this.graph = graph;
	this.visited = [];
	this.startNode = start;

	this.visited.push(this.startNode);
	
	var me = this;

	this.DepthFirst = function(endNode, maxHops, minHops) {
		var back = _.last(me.visited);
		var adjNodes = me.graph.neighbors(back);

		for(var i = 0; i < adjNodes.length; ++i) {
			var node = adjNodes[i];

			var startEqualTarget = me.startNode == endNode 
								&& me.startNode == node
								&& _.contains(me.visited, node);

			if ( ! startEqualTarget && _.contains(me.visited, node)) continue;

			if (node == end) {
				me.visited.push(node);

	            // Get hop count for this path
				var hops = me.visited.length - 1;
              
        	    if ((maxHops < 1 || hops <= maxHops) && hops >= minHops) {   
	                var path = visited.slice();
					me.paths.push(path);
        	    }           
           		            
	            me.visited.pop();
    	        break;
			}
		}

    // in breadth-first, recursion needs to come after visiting adjacent nodes
		for(var i = 0; i < adjNodes.length; ++i) {
			var node = adjNodes[i];

	        if (_.contains(me.visited, node) || node == end) continue;

	        me.visited.push(node);
        	me.DepthFirst(end, maxHops, minHops);        
	        me.visited.pop();
		}

	}

	this.DepthFirst(end, -1, -1);
	//console.log(this.paths);
	return this;
}

exports.TableGraph = TableGraph;
exports.GetAllPaths = GetAllPaths;

