
var assert = require('assert')
	, _ = require('underscore')
	, util = require('util')
	, graphlib = require('graphlib')
	, Table = require('../app/Table.js').Table
	, TableGraph = require('../app/TableGraph.js').TableGraph
	, graphutil = require('../app/graph_util.js')
	, Schema = require('../app/Schema.js').Schema;
	
var log = global.log;

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
		console.log(allPaths.paths);
	});

	it('get cycle', function() {
		var result = graphutil.FindCycle(graph);
		console.log(result.cycle);
	});

	it('get minimum spanning tree', function() {
		var mst = graphlib.alg.prim(graph, function(e) { return 1; });
		console.log(mst.edges());
	});

	it('get all cycles', function() {
		var result = graphutil.FindAllCycles(graph);
		console.log(result.cycles);
	});
});

describe('TableGraph SportEvent', function() {

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
/*
		schema = new Schema(tables);
		schema.init(function() {
			schema.create('sport_teams.sqlite');
		});
*/
	});	


	it('TableGraph.init', function() {
		console.log('\n*** nodes ***');
		console.log(tableGraph.graph.nodes());
		console.log('*** edges ***');
		console.log(tableGraph.graph.edges());
		console.log('\n*** spanning trees ***');
		_.each(tableGraph.trees, function(tree) {
			console.log(tree.edges());
		});
		console.log('\n*** joins ***');
		_.each([
			  ['persons', 'accomodations']
			, ['teams', 'persons']
			, ['teams', 'athletes']
			, ['athletes', 'persons']
			, ['accomodations', 'persons', 'athletes']
			, tableGraph.tables()
		], function(tables) {
			var joins = tableGraph.tableJoins(tables);
			console.log('tables ' + tables);
			console.log('joins count ' + joins.length);
			console.log(joins);
		});
/*
		var joins = tableGraph.tableJoins(['teams', 'persons']);
		console.log(joins);
		var joins = tableGraph.tableJoins(['persons', 'athletes']);
		console.log(joins);
		var joins = tableGraph.tableJoins(tableGraph.tables());
		console.log(joins);
*/
	});

/*
	it('Get all paths. persons - teams', function() {
		var allPaths = graphutil.GetAllPaths(tableGraph.graph, 'persons', 'teams');
		console.log(allPaths.paths);
	});

	it('Get all paths. persons - athletes', function() {
		var allPaths = graphutil.GetAllPaths(tableGraph.graph, 'persons', 'athletes');
		console.log(allPaths.paths);
	});
	it('Get all paths. teams - athletes', function() {
		var allPaths = graphutil.GetAllPaths(tableGraph.graph, 'teams', 'athletes');
		console.log(allPaths.paths);
	});
*/
});

