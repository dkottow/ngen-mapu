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

exports.GetAllPaths = GetAllPaths;
exports.FindAllCycles = FindAllCycles;
exports.FindCycle = FindCycle;
exports.DirectTreeEdgesAsGraph = DirectTreeEdgesAsGraph;

/*
 * FindAllCycles proceeds iteratively until no further cycles found.
 * It uses FindCycle from Sedgewick to find a cycle, 
 * then opens that cycle by removing its first edge. 
 * Iterates until no further cycles can be found.
 */
 		
function FindAllCycles(g) 
{	
	var me = this;
	var gc = graphlib.json.read(graphlib.json.write(g));
	me.cycles = [];
	do {
		var c = FindCycle(gc).cycle;
		//console.log(gc.edges());
		if (c.length > 0) {
			me.cycles.push(c);
			//remove 1st edge from cycle found
			//console.log('found cycle ' + c) ;
			//console.log('removing undirected edge ' + c[0] + ' - ' + c[1]) ;
			gc.removeEdge(c[0], c[1]);
			gc.removeEdge(c[1], c[0]);
		}
	} while (c.length > 0);
	return me;
}

/******************************************************************************
 *  Compilation:  javac Cycle.java
 *  Execution:    java  Cycle filename.txt
 *  Dependencies: Graph.java Stack.java In.java StdOut.java
 *
 *  Identifies a cycle.
 *  Runs in O(E + V) time.
 *
 *  % java Cycle tinyG.txt
 *  3 4 5 3
 *
 *  % java Cycle mediumG.txt
 *  15 0 225 15
 *
 *  % java Cycle largeG.txt
 *  996673 762 840164 4619 785187 194717 996673
 *
 ******************************************************************************/

/**
 *  The <tt>Cycle</tt> class represents a data type for
 *  determining whether an undirected graph has a cycle.
 *  The <em>hasCycle</em> operation determines whether the graph has
 *  a cycle and, if so, the <em>cycle</em> operation returns one.
 *  <p>
 *  This implementation uses depth-first search.
 *  The constructor takes time proportional to <em>V</em> + <em>E</em>
 *  (in the worst case),
 *  where <em>V</em> is the number of vertices and <em>E</em> is the number of edges.
 *  Afterwards, the <em>hasCycle</em> operation takes constant time;
 *  the <em>cycle</em> operation takes time proportional
 *  to the length of the cycle.
 *  <p>
 *  For additional documentation, see <a href="http://algs4.cs.princeton.edu/41graph">Section 4.1</a>
 *  of <i>Algorithms, 4th Edition</i> by Robert Sedgewick and Kevin Wayne.
 *
 *  @author Robert Sedgewick
 *  @author Kevin Wayne
 */

function FindCycle(g) 
{
	var me = this;

	me.cycle = [];
	me.marked = {};
	me.edgeTo = {};

	if (hasSelfLoop(g)) return me;
	if (hasParallelEdges(g)) return me;

	_.each(g.nodes(), function(v) {
		if (! me.marked[v]) dfs(g, null, v);
	});

    // does this graph have a self loop?
    // side effect: initialize cycle to be self loop
    function hasSelfLoop(g) {
		_.each(g.nodes(), function(v) {
			_.each(g.neighbors(v), function(w) {
				if (v == w) {
					me.cycle.push(v);
					me.cycle.push(v);
					return true;
				}
			});
		});
        return false;
    }

    // does this graph have two parallel edges?
    // side effect: initialize cycle to be two parallel edges
    function hasParallelEdges(g) {
		_.each(g.nodes(), function(v) {
			_.each(g.neighbors(v), function(w) {
				if (me.marked[w]) {
					me.cycle.push(v);
					me.cycle.push(w);
					me.cycle.push(v);
				}
				me.marked[w] = true;
			});
			_.each(g.neighbors(v), function(w) { me.marked[w] = false; });
		});
        return false;
    }

    function dfs(g, u, v) {
        me.marked[v] = true;
		_.each(g.neighbors(v), function (w) {

            // short circuit if cycle already found
			if (me.cycle.length > 0) return;

			if (! me.marked[w]) {
				me.edgeTo[w] = v;
				dfs(g, v, w);

            // check for cycle (but disregard reverse of edge leading to v)
			} else if (w != u) {
				me.cycle = [];
				for(x = v; x != w; x = me.edgeTo[x]) {
					me.cycle.push(x);
				}
				me.cycle.push(w);
				me.cycle.push(v);
            }
		});
    }

	return me;
}

/*
 * transcribed to JS from original in C# / C++
 * http://www.technical-recipes.com/2011/a-recursive-algorithm-to-find-all-paths-between-two-given-nodes/
*/

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
	                var path = me.visited.slice();
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

function r4() {
	return Math.random().toString().substr(4,4);
}

function DirectTreeEdgesAsGraph(tree, graph) {
	var result = new graphlib.Graph({ directed: true });
	_.each(tree.nodes(), function(n) { result.setNode(n); });
	_.each(tree.edges(), function(e) {
		if (graph.hasEdge(e)) {
			result.setEdge(e);
		} else {
			//flip edge
			result.setEdge(e.w, e.v);
		}
	});
	return result;
}



