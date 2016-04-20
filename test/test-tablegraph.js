
var assert = require('assert')
	, _ = require('underscore')
	, util = require('util')
	, graphlib = require('graphlib');
	
global.log = require('./log.js').log;
	
var Table = require('../app/Table.js').Table
	, TableGraph = require('../app/TableGraph.js').TableGraph
	, graphutil = require('../app/graph_util.js')
	, Schema = require('../app/Schema.js').Schema;
	
var log = global.log.child({'mod': 'mocha.test-tablegraph.js'});

describe('GetAllPaths', function() {

		var graph = new graphlib.Graph({ directed: false });

		before(function() {
			graph.setEdge('1', '6', 1.0);
			graph.setEdge('1', '2', 2.5 );	
			graph.setEdge('1', '4', 3.0 );
			graph.setEdge('1', '5', 0.5 );
			graph.setEdge('2', '1', 0.5 );
			graph.setEdge('2', '3', 3.0 );
			graph.setEdge('2', '4', 2.0 );
			graph.setEdge('2', '7', 10.5 );
			graph.setEdge('2', '5', 2.5 );
			graph.setEdge('3', '4', 1.0 );
			graph.setEdge('3', '7', 1.5 );
			graph.setEdge('4', '5', 1.0 );
			graph.setEdge('5', '4', 0.5 );
			graph.setEdge('5', '6', 0.5 );
			graph.setEdge('5', '7', 1.5 );
			graph.setEdge('7', '6', 1.0 );
		});

	it('get all paths', function() {
		var allPaths = graphutil.GetAllPaths(graph, '2', '7');
		log.info(allPaths.paths);
	});

	it('get cycle', function() {
		var result = graphutil.FindCycle(graph);
		log.info(result.cycle);
	});

	it('get minimum spanning tree', function() {
		var mst = graphlib.alg.prim(graph, function(e) { return 1; });
		log.info(mst.edges());
	});

	it('get all cycles', function() {
		var result = graphutil.FindAllCycles(graph);
		log.info(result.cycles);
	});
});

describe('Sandwiches DB', function() {

	var jsonFile = 'test/sales.json';
	var tableGraph;
	beforeEach(function(done) {	

		var schema = new Schema();
		schema.jsonRead(jsonFile, function(err) {
			log.info(err);
			assert(err == null, err);
			tableGraph = schema.graph;
			done();
		});
	});	


	it('TableGraph.init', function() {
		log.info({nodes: tableGraph.graph.nodes()});
		log.info({edges: tableGraph.graph.edges()});
		_.each(tableGraph.trees, function(tree) {
			log.info({nodes: tree.nodes()}, 'soccer tree nodes');
			log.info({edges: tree.edges()}, 'soccer tree edges');
		});
		log.info('\n*** joins ***');
		_.each([
			  { fromTable: 'products', joinTables: ['orders']}
			, { fromTable: 'customers', joinTables: ['products']}
			, { fromTable: 'customers', 
				joinTables: ['products_in_orders']}
			, { fromTable: 'orders', 
				joinTables: ['customers', 'products', 
							'products_in_orders']}
		], function(tables) {

			var joins = tableGraph.tableJoins(tables.fromTable, 
				tables.joinTables);

			log.info({tables, tables}, 'tables');
			log.info({joins, joins}, 'joins');
/*
			var sql = tableGraph.joinSQL(tables);
			log.info('join SQL');
			log.info(sql);
*/
		});
	});

	it('TableGraph.tablesByDependencies', function() {
		//TODO test me better, shuffle table ordering
		var tables = tableGraph.tables();
		var tablesByDeps = tableGraph.tablesByDependencies();
		log.info(_.pluck(tables, 'name'));
		log.info('by deps');
		log.info(_.pluck(tablesByDeps, 'name'));
	});
});


describe('Soccer DB', function() {

	var jsonFile = "test/soccer.json";
	var tableGraph;

	function loadUserTrees() {
		var trees = [];

		tree = new graphlib.Graph();
		tree.setNode('Position');
		tree.setNode('Player');
		tree.setNode('Team');
		tree.setEdge('Player', 'Position');
		tree.setEdge('Player', 'Team');
		trees.push(tree);

		tree = new graphlib.Graph();
		tree.setNode('Player');
		tree.setNode('Formation');
		tree.setNode('Position');
		tree.setNode('Game');
		tree.setNode('Team');
		tree.setNode('Venue');
		tree.setEdge('Formation', 'Player');
		tree.setEdge('Formation', 'Position');
		tree.setEdge('Formation', 'Game');
		tree.setEdge('Game', 'Team');
		tree.setEdge('Game', 'Venue');
		trees.push(tree);

		return trees;
	}

	beforeEach(function(done) {		
		var schema = new Schema();
		schema.jsonRead(jsonFile, function(err) {
			log.info(err);
			assert(err == null, err);
			tableGraph = schema.graph;
		
			//replace trees = [mst] by user def trees
			tableGraph.trees = loadUserTrees();

			done();
		});
	});	


	it('TableGraph.init', function() {
		log.info({nodes: tableGraph.graph.nodes()}, 'soccer nodes');
		log.info({edges: tableGraph.graph.edges()}, 'soccer edges');
//console.log(tableGraph.graph.edge('Game', 'Team'));
		_.each(tableGraph.trees, function(tree) {
			log.info({nodes: tree.nodes()}, 'soccer tree nodes');
			log.info({edges: tree.edges()}, 'soccer tree edges');
		});

		_.each([
			  { fromTable: 'Game', joinTables: ['Venue'] }
			, { fromTable: 'Team', joinTables: ['Player'] }
			, { fromTable: 'Team', joinTables: ['Formation'] }
			, { fromTable: 'Formation', joinTables: ['Position'] }
			, { fromTable: 'Venue', 
				joinTables: ['Player', 'Team'] }

		], function(tables) {

			log.info({from: tables.fromTable, to: tables.joinTables}, 
				'test.getJoins()...');

			var joins = tableGraph.tableJoins(tables.fromTable, 
				tables.joinTables);

			log.info({joins: joins}, '...test.getJoins()');
		});
	});

	it('TableGraph.tablesByDependencies', function() {
		//TODO test me better, shuffle table ordering
		var tables = tableGraph.tables();
		var tablesByDeps = tableGraph.tablesByDependencies();
		log.info(_.pluck(tables, 'name'));
		log.info('by deps');
		log.info(_.pluck(tablesByDeps, 'name'));
	});
});

