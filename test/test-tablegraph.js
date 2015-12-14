
var assert = require('assert')
	, _ = require('underscore')
	, util = require('util')
	, sqlite3 = require('sqlite3').verbose()
	, Table = require('../app/Table.js').Table
	, TableGraph = require('../app/TableGraph.js').TableGraph;
	
var log = global.log;

describe('TableGraph', function() {

	describe('Sales', function() {

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

		
		var tables;
		before(function() {
			tables = _.map(tableDefs, function(def) {
				return new Table(def);
			});
		});	

		it('TableGraph.path', function() {
			var tableGraph = new TableGraph(tables);
			var path = tableGraph.path('customers', 'products');
			assert(path.joins.length, 3);
			assert(path.distinct);
			assert(path.joins[0].table, 'customers');
			assert(path.joins[0].join_table, 'orders');
			assert(path.joins[0].fk_table, 'orders');
			assert(path.joins[0].fk, 'customer_id');
			assert(path.joins[2].table, 'products');
			assert(path.joins[2].join_table, 'products_in_orders');
			assert(path.joins[2].fk_table, 'products_in_orders');
			assert(path.joins[2].fk, 'product_id');
			//console.log(path);

		});

		it('TableGraph.tableJSON', function() {
			var tableGraph = new TableGraph(tables);
			var json = tableGraph.tableJSON('orders');
			assert(json.parents[0] == 'customers');
			assert(json.children[0] == 'products_in_orders');

		});

		it('TableGraph.toSQL', function() {
			var tableGraph = new TableGraph(tables);
			var joins = tableGraph.path('customers', 'products');
			var sql = tableGraph.toSQL(joins);
			console.log(sql);
			//var j2 = tableGraph.path('products', 'orders');
			var j2 = tableGraph.path('customers', 'orders');
			console.log(tableGraph.toSQL(j2));
			var sqlCombined = tableGraph.toSQL([joins, j2]);
			//console.log(sqlCombined);
			assert(sql.sql, sqlCombined.sql);
		});
	});

	describe('Movies', function() {

		var tableDefs = [
			 { "name": "crew"
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
					, "contact": {
						  "name": "contact"
						, "type": "INTEGER"
						, "fk_table": "crew"
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
		   , { "name": "movies"
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
					, "director": {
						  "name": "director"
						, "type": "INTEGER"
						, "fk_table": "crew"
						, "order": 2
					}
					, "producer": {
						  "name": "producer"
						, "type": "INTEGER"
						, "fk_table": "crew"
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
		];

		
		var tables;
		before(function() {
			tables = _.map(tableDefs, function(def) {
				return new Table(def);
			});
		});	

		it('TableGraph.path', function() {
			var tableGraph = new TableGraph(tables);
			console.log(tableGraph.graph.edges());
			console.log(tableGraph.graph.edge('movies', 'crew'));
			var path = tableGraph.path('crew', 'movies');
			console.log(path);

		});
	});
});


