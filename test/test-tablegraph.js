
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

describe('SandwichSales DB', function() {
	var tableDefs = [
		 { "name": "customers"
		 , "row_alias": ["name", "email"]
		 , "fields": {
				  "id": {
					  "name": "id"
					, "type": "INTEGER"
					, "order": 0
				}
				, "name": {
					  "name": "name"
					, "type": "VARCHAR"
					, "order": 1
				}
				, "email": {
					  "name": "email"
					, "type": "VARCHAR(256)"
					, "order": 2
				}
				, "modified_by": {
					  "name": "modified_by"
					, "type": "VARCHAR(64)"
					, "order": 91
				}
				, "modified_on": {
					  "name": "modified_on"
					, "type": "DATETIME"
					, "order": 92
				}
			}		
		 }
	   , { "name": "products"
		 , "row_alias": ["name"]		  	
		 , "fields": {
				  "id": {
					  "name": "id"
					, "type": "INTEGER"
					, "order": 0
				}
				, "name": {
					  "name": "name"
					, "type": "VARCHAR"
					, "order": 1
				}
				, "price": {
					  "name": "price"
					, "type": "NUMERIC(8,2)"
					, "order": 2
				}
				, "modified_by": {
					  "name": "modified_by"
					, "type": "VARCHAR(64)"
					, "order": 3
				}
				, "modified_on": {
					  "name": "modified_on"
					, "type": "DATETIME"
					, "order": 4
				}
			}		
		 }
	   , { "name": "orders"
		 , "row_alias": ["order_date", "customers.name"]		  	
		 , "fields": {
				  "id": {
					  "name": "id"
					, "type": "INTEGER"
					, "order": 0
				}
				, "order_date": {
					  "name": "order_date"
					, "type": "DATE"
					, "order": 1
				}
				, "customer_id": {
					  "name": "customer_id"
					, "type": "INTEGER"
					, "fk_table": "customers"
					, "order": 2
				}
				, "total_amount": {
					  "name": "total_amount"
					, "type": "NUMERIC(8,2)"
					, "order": 3
				}
				, "modified_by": {
					  "name": "modified_by"
					, "type": "VARCHAR(256)"
					, "order": 91
				}
				, "modified_on": {
					  "name": "modified_on"
					, "type": "DATETIME"
					, "order": 92
				}
			}		
		 }
	   , { "name": "products_in_orders"
		 , "fields": {
				  "id": {
					  "name": "id"
					, "type": "INTEGER"
					, "order": 0
				}
				, "order_id": {
					  "name": "order_id"
					, "type": "INTEGER"
					, "fk_table": "orders"
					, "order": 1
				}
				, "product_id": {
					  "name": "product_id"
					, "type": "INTEGER"
					, "fk_table": "products"
					, "order": 2
				}
				, "unit_price": {
					  "name": "unit_price"
					, "type": "NUMERIC(8,2)"
					, "order": 3
				}
				, "quantity": {
					  "name": "quantity"
					, "type": "INTEGER"
					, "order": 4
				}
				, "modified_by": {
					  "name": "modified_by"
					, "type": "VARCHAR(256)"
					, "order": 91
				}
				, "modified_on": {
					  "name": "modified_on"
					, "type": "DATETIME"
					, "order": 92
				}
			}		
		 }
	];

	var tableGraph;
	beforeEach(function() {		
		var tables = _.map(tableDefs, function(def) {
			return new Table(def);
		});
		tableGraph = new TableGraph(tables);
	});	


	it('TableGraph.init', function() {
		log.info('\n*** nodes ***');
		log.info(tableGraph.graph.nodes());
		log.info('*** edges ***');
		log.info(tableGraph.graph.edges());
		log.info('\n*** spanning trees ***');
		_.each(tableGraph.trees, function(tree) {
			log.info(tree.edges());
		});
		log.info('\n*** joins ***');
		_.each([
			  ['products', 'orders']
			, ['customers', 'products']
			, ['customers', 'products_in_orders']
			, _.pluck(tableGraph.tables(), 'name')
		], function(tables) {
			var joins = tableGraph.tableJoins(tables);
			log.info('tables ' + tables);
			log.info('joins count ' + joins.length);
			log.info(joins);
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


describe('AthleteTeam DB', function() {

	var tableDefs = [
		 { "name": "accomodations"
		 , "row_alias": ["name"]
		 , "fields": {
				  "id": {
					  "name": "id"
					, "type": "INTEGER"
					, "order": 0
				}
				, "name": {
					  "name": "name"
					, "type": "VARCHAR"
					, "order": 1
				}
				, "modified_by": {
					  "name": "modified_by"
					, "type": "VARCHAR(64)"
					, "order": 91
				}
				, "modified_on": {
					  "name": "modified_on"
					, "type": "DATETIME"
					, "order": 92
				}
			}
		 }
	   , { "name": "persons"
		 , "row_alias": ["name"]
		 , "fields": {
				  "id": {
					  "name": "id"
					, "type": "INTEGER"
					, "order": 0
				}
				, "name": {
					  "name": "name"
					, "type": "VARCHAR"
					, "order": 1
				}
				, "accomodation_id": {
					  "name": "accomodation_id"
					, "type": "INTEGER"
					, "fk_table": "accomodations"
					, "order": 2
				}
/*
				, "contact_id": {
					  "name": "contact_id"
					, "type": "INTEGER"
					, "fk_table": "persons"
					, "order": 2
				}
*/
				, "modified_by": {
					  "name": "modified_by"
					, "type": "VARCHAR(64)"
					, "order": 91
				}
				, "modified_on": {
					  "name": "modified_on"
					, "type": "DATETIME"
					, "order": 92
				}
			}		
		 }
	   , { "name": "teams"
		 , "row_alias": ["name"]		  	
		 , "fields": {
				  "id": {
					  "name": "id"
					, "type": "INTEGER"
					, "order": 0
				}
				, "country": {
					  "name": "country"
					, "type": "VARCHAR"
					, "order": 1
				}
				, "coach_id": {
					  "name": "coach_id"
					, "type": "INTEGER"
					, "fk_table": "persons"
					, "order": 2
				}
				, "leader_id": {
					  "name": "leader_id"
					, "type": "INTEGER"
					, "fk_table": "persons"
					, "order": 3
				}
				, "modified_by": {
					  "name": "modified_by"
					, "type": "VARCHAR(64)"
					, "order": 91
				}
				, "modified_on": {
					  "name": "modified_on"
					, "type": "DATETIME"
					, "order": 92
				}
			}		
		 }
	   , { "name": "athletes"
		 , "row_alias": ["teams.name", "persons.name"]		  	
		 , "fields": {
				  "id": {
					  "name": "id"
					, "type": "INTEGER"
					, "order": 0
				}
				, "team_id": {
					  "name": "team_id"
					, "type": "INTEGER"
					, "fk_table": "teams"
					, "order": 1
				}
				, "person_id": {
					  "name": "person_id"
					, "type": "INTEGER"
					, "fk_table": "persons"
					, "order": 1
				}
				, "modified_by": {
					  "name": "modified_by"
					, "type": "VARCHAR(64)"
					, "order": 91
				}
				, "modified_on": {
					  "name": "modified_on"
					, "type": "DATETIME"
					, "order": 92
				}
			}		
		 }
	];

	
	var tableGraph;
	beforeEach(function() {		
		var tables = _.map(tableDefs, function(def) {
			return new Table(def);
		});
		tableGraph = new TableGraph(tables);
	});	


	it('TableGraph.init', function() {
		log.info('\n*** nodes ***');
		log.info(tableGraph.graph.nodes());
		log.info('*** edges ***');
		log.info(tableGraph.graph.edges());
		log.info('\n*** spanning trees ***');
		_.each(tableGraph.trees, function(tree) {
			log.info(tree.edges());
		});
		log.info('\n*** joins ***');
		_.each([
			  ['persons', 'accomodations']
			, ['teams', 'persons']
			, ['teams', 'athletes']
			, ['athletes', 'persons']
			, ['accomodations', 'persons', 'athletes']
			, _.pluck(tableGraph.tables(), 'name')
		], function(tables) {
			var joins = tableGraph.tableJoins(tables);
			log.info('tables ' + tables);
			log.info('joins count ' + joins.length);
			log.info(joins);
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

