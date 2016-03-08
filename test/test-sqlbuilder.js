
var assert = require('assert')
	, _ = require('underscore')
	, util = require('util')
	, Table = require('../app/Table.js').Table
	, TableGraph = require('../app/TableGraph.js').TableGraph
	, SqlBuilder = require('../app/SqlBuilder.js').SqlBuilder;

var fs = require('fs');
	
var log = global.log;

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

	var sqlBuilder;
	beforeEach(function() {		
		var tables = _.map(tableDefs, function(def) {
			return new Table(def);
		});
		var tableGraph = new TableGraph(tables);
		sqlBuilder = new SqlBuilder(tableGraph);
	});	


	it('SqlBuilder.joinSQL', function() {
		
		_.each([
			  ['products', 'orders']
			, ['customers', 'products']
			, ['customers', 'products_in_orders']
			, _.pluck(sqlBuilder.graph.tables(), 'name')
		], function(tables) {
			console.log('\ntables ' + tables);

			var sql = sqlBuilder.joinSQL(tables);
			console.log('sql');
			console.log(sql);

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
				field: '*',
				table: 'products',
				op: 'search',
				value: 'car'
			},
			
		];
		
		var result = sqlBuilder.filterSQL(filterClauses);
		console.log(result.query);
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

		//console.log(result.query);
		console.log(sqlReplaceParams(result));
	});

	it('SqlBuilder.createViewSQL', function() {
		//var table = sqlBuilder.graph.table('products_in_orders');
		var table = sqlBuilder.graph.table('orders');
		var result = sqlBuilder.createViewSQL(table);
		console.log(result);
	});

	it('SqlBuilder.createSQL', function() {
		//var table = sqlBuilder.graph.table('products_in_orders');
		var result = sqlBuilder.createSQL();
		fs.writeFile('create.sql', result);
		console.log(result);
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
				field: '*',  //full row search
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

		//console.log(result.query);
		console.log(sqlReplaceParams(result));
	});

	it('SqlBuilder.createViewSQL', function() {
		var table = sqlBuilder.graph.table('teams');
		var result = sqlBuilder.createViewSQL(table);
		console.log(result);
	});
});

