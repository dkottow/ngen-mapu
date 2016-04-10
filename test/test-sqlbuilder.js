
var assert = require('assert')
	, _ = require('underscore')
	, util = require('util')
	, fs = require('fs');
	
global.log = require('./log.js').log;
	
var Table = require('../app/Table.js').Table
	, Schema = require('../app/Schema.js').Schema //to read json
	, TableGraph = require('../app/TableGraph.js').TableGraph
	, SqlBuilder = require('../app/SqlBuilder.js').SqlBuilder;

var log = global.log.child({'mod': 'mocha.test-sqlbuilder.js'});
	
function sqlReplaceParams(selectResult) {
	var sql = selectResult.query;
	var pos = sql.length - 1;
	for(var i = selectResult.params.length - 1; i >= 0; --i) {
		var param = selectResult.params[i];
		pos = sql.lastIndexOf('?', pos);
		if (_.isString(param)) param = "'" + param + "'";
		sql = sql.substr(0, pos) + param + sql.substr(pos+1);
	}
	return sql;
}

describe('SandwichSales DB', function() {

	var jsonSalesFile = "test/sales.json";
	var sqlBuilder;

	beforeEach(function(done) {		
		var schema = new Schema();
		schema.jsonRead(jsonSalesFile, function(err) {
			log.info(err);
			assert(err == null, err);
			sqlBuilder = schema.sqlBuilder;
			done();
		});
/*
		var tables = _.map(tableDefs, function(def) {
			return new Table(def);
		});
		var tableGraph = new TableGraph(tables);
		sqlBuilder = new SqlBuilder(tableGraph);
*/
	});	


	it('SqlBuilder.joinSQL', function() {
		
		_.each([
			  ['products', 'orders']
			, ['customers', 'products']
			, ['customers', 'products_in_orders']
			, _.pluck(sqlBuilder.graph.tables(), 'name')
		], function(tables) {
			log.info('\ntables ' + tables);

			var sql = sqlBuilder.joinSQL(tables[0], tables);
			log.info('sql');
			log.info(sql);

		});
	});

	it('SqlBuilder.filterSQL', function() {
		var filterClauses = [
			{
				field: 'name',
				table: 'customers',
				op: 'eq',
				value: 'Daniel'
			},
			{
				field: 'total_amount',
				table: 'orders',
				op: 'btwn',
				value: [40.00, 80.00]
			},
			{
				field: 'products',
				//field: '*',
				table: 'products',
				op: 'search',
				value: 'car'
			},
			
		];
		
		var result = sqlBuilder.filterSQL(filterClauses);
		log.info(result.query);
	});

	it('SqlBuilder.selectSQL', function() {
		var filterClauses = [
			{
				field: 'name',
				table: 'customers',
				op: 'eq',
				value: 'Daniel'
			},
			{
				field: 'total_amount',
				table: 'orders',
				op: 'btwn',
				value: [40.00, 80.00]
			},
			/*
			{
				field: '',
				table: 'products',
				op: 'search',
				value: 'car'
			},
			*/
		];
		
		var table = sqlBuilder.graph.table('orders');
		var fields = '*';
		//var fields = ['ref', 'customers_ref', 'total_amount'];
		var orderClauses = [];
		var limit = 10;
		var offset = 50;
		var result = sqlBuilder.selectSQL(table, fields, filterClauses,
					orderClauses, limit, offset);

		//log.info(result.query);
		log.info(sqlReplaceParams(result));
	});

	it('SqlBuilder.createViewSQL', function() {
		//var table = sqlBuilder.graph.table('products_in_orders');
		var table = sqlBuilder.graph.table('orders');
		var result = sqlBuilder.createViewSQL(table);
		log.info(result);
	});

	it('SqlBuilder.createSQL', function() {
		//var table = sqlBuilder.graph.table('products_in_orders');
		var result = sqlBuilder.createSQL();
		fs.writeFile('create.sql', result);
		log.info(result);
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
				, "score": {
					  "name": "score"
					, "type": "NUMERIC(4,1)"
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

	var sqlBuilder;
	beforeEach(function() {		
		var tables = _.map(tableDefs, function(def) {
			return new Table(def);
		});
		var tableGraph = new TableGraph(tables);
		sqlBuilder = new SqlBuilder(tableGraph);
	});	


	it('SqlBuilder.selectSQL', function() {
		var filterClauses = [
			{
				//field: '*',  //full row search
				field: 'teams',  //full row search
				table: 'teams',
				op: 'search',
				value: 'chile'
			},
			{
				field: 'score',
				table: 'athletes',
				op: 'ge',
				value: 100 
			},
		];
		
		var table = sqlBuilder.graph.table('persons');
		var fields = ['name'];
		//var fields = ['ref', 'customers_ref', 'total_amount'];
		var orderClauses = [];
		var limit = 10;
		var offset = 50;
		var result = sqlBuilder.selectSQL(table, fields, filterClauses,
					orderClauses, limit, offset);

		//log.info(result.query);
		log.info(sqlReplaceParams(result));
	});

	it('SqlBuilder.createViewSQL', function() {
		var table = sqlBuilder.graph.table('teams');
		var result = sqlBuilder.createViewSQL(table);
		log.info(result);
	});
});

