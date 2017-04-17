
var assert = require('assert')
	, _ = require('underscore')
	, fs = require('fs')
	, util = require('util')
	, graphlib = require('graphlib');
	
var Table = require('../app/Table.js').Table
	, TableGraph = require('../app/TableGraph.js').TableGraph
	, graphutil = require('../app/graph_util.js')
	, Schema = require('../app/Schema.js').Schema
	, Database = require('../app/sqlite/DatabaseSqlite.js').DatabaseSqlite;
	
var log = require('./log.js').log;

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

var jsonDir = "test/data/json";
var sqliteDir = "test/data/sqlite";

describe('Sandwiches DB', function() {

	var schemaFile = jsonDir + '/sales.json';
	var tableGraph;
	beforeEach(function(done) {	

		var schema = new Schema();
		schema.jsonRead(schemaFile, function(err) {
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

			log.info({tables: tables}, 'tables');
			log.info({joins: joins}, 'joins');
/*
			var sql = tableGraph.joinSQL(tables);
			log.info('join SQL');
			log.info(sql);
*/
		});
	});

	it('TableGraph.parentTables', function() {
		var table = tableGraph.table('products_in_orders');
		var tables = tableGraph.parentTables(table);
		var names = _.pluck(tables, 'name').sort();				
		assert(names[0] == 'orders' && names[1] == 'products');
	});

	it('TableGraph.childTables', function() {
		var t1 = tableGraph.table('products');
		var t2 = tableGraph.table('orders');
		var ct1 = tableGraph.childTables(t1);
		var ct2 = tableGraph.childTables(t2);
		log.info({ child1: ct1[0].name, child2: ct2[0].name });
		assert(ct1[0].name == 'products_in_orders' 
			&& ct2[0].name == 'products_in_orders');
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

	var schemaFile = jsonDir + "/soccer.json";
	var tableGraph;

	beforeEach(function(done) {		
		var schema = new Schema();
		schema.jsonRead(schemaFile, function(err) {
			log.info(err);
			assert(err == null, err);
			tableGraph = schema.graph;
		
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

describe('RowsToObj Sandwiches DB', function() {

	var dbFile = sqliteDir + '/sandwiches.sqlite';
	var db = new Database(dbFile);
	var tableGraph;
	var customerCount;

	before(function(done) {	

		db.readSchema(function(err) {
			assert(err == null, err);
			tableGraph = db.schema.graph;
			var options = {
				fields : [
					'customer_id'
				]
				, filter : [
					{   
						'field': 'customer_id', 
						'op': 'btwn', 
						'value': [1, 5]
					}
				]
			};	
			db.all('orders', options, function(err, result) {
				customerCount = result.rows.length;
				done();
			});
		});

	});	

	it('TableGraph.rowsToObj customers', function(done) {

		this.timeout(2000);

		var options = {
			fields : [
				'id', 'name'
				, { table: 'orders', field: 'id' }	
				, { table: 'orders', field: 'order_date' }	
				, { table: 'orders', field: 'total_amount' }	
				, { table: 'order_items', field: 'id' }	
				, { table: 'order_items', field: 'quantity' }	
				, { table: 'order_items', field: 'unit_price' }	
				, { table: 'sandwiches', field: 'id' }	
				, { table: 'sandwiches', field: 'name' }	
				, { table: 'sandwiches', field: 'origin' }	
				, { table: 'sandwiches', field: 'price' }	
			]
			, filter : [
				{   
					'field': 'id', 
					'op': 'btwn', 
					'value': [1, 5]
				}
			],
			limit: 200
		};

		db.all('customers', options, function(err, result) {
	
			assert(err == null, 'db.all failed');

			var rows = result.rows;
			var obj = tableGraph.rowsToObj(rows, 'customers');
			//console.log(util.inspect(obj, false, null));

			assert(obj.customers.length == customerCount, 
				'Expected ' + customerCount + ' customers.'
				+ ' Got ' + obj.customers.length);
			done();
		});

	});

	it('TableGraph.rowsToObj orders', function(done) {

		this.timeout(2000);

		var options = {
			fields : [
				'id', 'order_date', 'total_amount'
				, { table: 'customers', field: 'id' }	
				, { table: 'customers', field: 'name' }	
				, { table: 'order_items', field: 'id' }	
				, { table: 'order_items', field: 'quantity' }	
				, { table: 'order_items', field: 'unit_price' }	
				, { table: 'sandwiches', field: 'id' }	
				, { table: 'sandwiches', field: 'name' }	
				, { table: 'sandwiches', field: 'origin' }	
				, { table: 'sandwiches', field: 'price' }	
			]
			, filter : [
				{   
					'table': 'customers'
					, 'field': 'id' 
					, 'op': 'btwn'
					, 'value': [1, 5]
				}
			],
			limit: 200
		};

		db.all('orders', options, function(err, result) {
	
			assert(err == null, 'db.all failed');

			var rows = result.rows;
			var obj = tableGraph.rowsToObj(rows, 'orders');
			//console.log(util.inspect(obj, false, null));

			var customers = {};
			_.each(obj.orders, function(order) {
				customers[order.customers.id] = order.customers;
			});

			//console.log(customers);
			
			assert(_.keys(customers).length == customerCount, 'Expected ' + customerCount  + ' distinct customers got ' + _.keys(customers).length);
			done();
		});

	});

});

describe('RowsToObj Soccer DB', function() {

	var dbFile = sqliteDir + '/soccer.sqlite';
	var db = new Database(dbFile);
	var tableGraph;

	before(function(done) {	

		db.readSchema(function(err) {
			assert(err == null, err);
			tableGraph = db.schema.graph;
			done();
		});

	});	

	it('TableGraph.rowsToObj Game', function(done) {

		this.timeout(2000);

		var options = {
			fields : [
				'id', 'EventDate', 'EventTime', 'Team1_ref', 'Team2_ref'
				, { table: 'Team', field: 'id' }	
				, { table: 'Team', field: 'Name' }	
				, { table: 'Team', field: 'Country' }	
				, { table: 'Formation', field: 'id' }	
				, { table: 'Player', field: 'id' }	
				, { table: 'Player', field: 'Name' }	
				, { table: 'Player', field: 'DateOfBirth' }	
				, { table: 'Position', field: 'Code' }	
				, { table: 'Position', field: 'Name' }	
				, { table: 'Venue', field: 'Name' }	
			]
			, filter : [
				{   
					'field': 'id', 
					'op': 'in', 
					'value': [1, 5, 7]
				}
			],
			limit: 200
		};

		db.all('Game', options, function(err, result) {
	
			if (err) console.log(err);
			assert(err == null, 'db.all failed');

			var rows = result.rows;
			var obj = tableGraph.rowsToObj(rows, 'Game');
			log.debug(util.inspect(obj, false, null));

			assert(obj.Game.length == 3, 'Expected 3 Game objects');
			done();
		});

	});


	it('TableGraph.rowsToObj Team', function(done) {

		this.timeout(2000);

		var options = {
			fields : [
				'id', 'Name', 'Country'
				, { table: 'Game', field: 'id' }	
				, { table: 'Game', field: 'EventDate' }	
				, { table: 'Game', field: 'EventTime' }	
				, { table: 'Game', field: 'Team1_ref' }	
				, { table: 'Game', field: 'Team2_ref' }	
				, { table: 'Formation', field: 'id' }	
				, { table: 'Player', field: 'id' }	
				, { table: 'Player', field: 'Name' }	
				, { table: 'Player', field: 'DateOfBirth' }	
				, { table: 'Player', field: 'PreferredPosition_ref' }	
				, { table: 'Position', field: 'Code' }	
				, { table: 'Position', field: 'Name' }	
				, { table: 'Venue', field: 'Name' }	
			]
			, filter : [
				{   
					'table': 'Game'
					, 'field': 'id'
					, 'op': 'in'
					, 'value': [1, 5, 7]
				}
			],
			limit: 200
		};

		db.all('Team', options, function(err, result) {
	
			if (err) console.log(err);
			assert(err == null, 'db.all failed');

			var rows = result.rows;
			var obj = tableGraph.rowsToObj(rows, 'Team');
			//console.log(util.inspect(obj, false, null));

			var games = {};
			_.each(obj.Team, function(team) {
				_.each(team.Player, function(player) {
					_.each(player.Formation, function(f) {
						games[f.Game.id] = f.Game;
					});
				});
			});
			//console.log(games);

			assert(_.keys(games).length == 3, 
				'Expected 3 Game objects. Got ' + _.keys(games).length);
			done();
		});

	});
/*
	it('TableGraph.rowsToObj games', function() {

		var jsonDataFile = jsonDir + '/soccer_games_rows.json';
		var rows = JSON.parse(fs.readFileSync(jsonDataFile, 'utf8'));	
		var obj = tableGraph.rowsToObj(rows, 'Game');
		//console.log(util.inspect(obj, false, null));
		//console.log('got ' + obj['Game'].length + ' objects');
	});

	it('TableGraph.rowsToObj teams', function() {

		var jsonDataFile = jsonDir + '/soccer_teams_rows.json';
		var rows = JSON.parse(fs.readFileSync(jsonDataFile, 'utf8'));	
		var obj = tableGraph.rowsToObj(rows, 'Team');
		console.log(util.inspect(obj, false, null));
		console.log('got ' + obj['Team'].length + ' objects');
	});
*/
});

