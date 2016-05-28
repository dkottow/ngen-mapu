
var APP_PATH = "../../app/";

var assert = require('assert')
	, _ = require('underscore')
	, util = require('util')
	, sqlite3 = require('sqlite3').verbose()
	, schema = require(APP_PATH + 'Schema')
	, Model = require(APP_PATH + 'Database').Database;
	
var log = global.log;

//run me from root dir mocha etc/create-sales.js to create sales.sqlite

describe('Schema', function() {

	var salesSchema = {
		tables : [
			 { "name": "customers"
			 , "row_alias": ["name", "email"]
			 , "fields": {
					  "id": {
						  "name": "id"
						, "type": "INTEGER"
						, "props": {
							"order": 0
						}
					}
					, "name": {
						  "name": "name"
						, "type": "VARCHAR"
						, "props": {
							"width": 40
						  , "order": 1
						}
					}
					, "email": {
						  "name": "email"
						, "type": "VARCHAR(256)"
						, "props": {
							"width": 60
						  , "order": 2
						}
					}
					, "mod_by": {
						  "name": "mod_by"
						, "type": "VARCHAR(64)"
						, "props": {
							"order": 91
						}
					}
					, "mod_on": {
						  "name": "mod_on"
						, "type": "DATETIME"
						, "props": {
							"order": 92,
							"width": 10
						}
					}
				}		
			 }
		   , { "name": "products"
			 , "row_alias": ["name"]		  	
			 , "fields": {
					  "id": {
						  "name": "id"
						, "type": "INTEGER"
						, "props": {
							"order": 0
						}
					}
					, "name": {
						  "name": "name"
						, "type": "VARCHAR"
						, "props": {
							"width": 30
						  , "order": 1
						}
					}
					, "price": {
						  "name": "price"
						, "type": "NUMERIC(8,2)"
						, "props": {
							"scale": 2
						  , "order": 2
						}
					}
					, "mod_by": {
						  "name": "mod_by"
						, "type": "VARCHAR(64)"
						, "props": {
							"order": 3
						}
					}
					, "mod_on": {
						  "name": "mod_on"
						, "type": "DATETIME"
						, "props": {
							"order": 4,
							"width": 10
						}
					}
				}		
			 }
		   , { "name": "orders"
			 , "row_alias": ["order_date", "customers.name"]		  	
			 , "fields": {
					  "id": {
						  "name": "id"
						, "type": "INTEGER"
						, "props": {
							"order": 0
						}
					}
					, "order_date": {
						  "name": "order_date"
						, "type": "DATE"
						, "props": {
							"order": 1
						}
					}
					, "customer_id": {
						  "name": "customer_id"
						, "type": "INTEGER"
						, "fk_table": "customers"
						, "props": {
							"order": 2
						  , "width": 40
						}
					}
					, "total_amount": {
						  "name": "total_amount"
						, "type": "NUMERIC(8,2)"
						, "props": {
							"scale": 2
						  , "width": 12
						  , "order": 3
						}
					}
					, "mod_by": {
						  "name": "mod_by"
						, "type": "VARCHAR(256)"
						, "props": {
							"order": 91
						}
					}
					, "mod_on": {
						  "name": "mod_on"
						, "type": "DATETIME"
						, "props": {
							"order": 92,
							"width": 10
						}
					}
				}		
			 }
		   , { "name": "products_in_orders"
			 , "fields": {
					  "id": {
						  "name": "id"
						, "type": "INTEGER"
						, "props": {
							"order": 0
						}
					}
					, "order_id": {
						  "name": "order_id"
						, "type": "INTEGER"
						, "fk_table": "orders"
						, "props": {
							"order": 1
						  , "width": 40
						}
					}
					, "product_id": {
						  "name": "product_id"
						, "type": "INTEGER"
						, "fk_table": "products"
						, "props": {
							"order": 2
						  , "width": 30
						}
					}
					, "unit_price": {
						  "name": "unit_price"
						, "type": "NUMERIC(8,2)"
						, "props": {
							"scale": 2
						  , "order": 3
						}
					}
					, "quantity": {
						  "name": "quantity"
						, "type": "INTEGER"
						, "props": {
							"order": 4
						}
					}
					, "mod_by": {
						  "name": "mod_by"
						, "type": "VARCHAR(256)"
						, "props": {
							"order": 91
						}
					}
					, "mod_on": {
						  "name": "mod_on"
						, "type": "DATETIME"
						, "props": {
							"order": 92,
							"width": 10
						}
					}
				}		
			 }
		]
	};		

	describe('Sales', function() {
		var dbFile = "./sales.sqlite";
		var jsonFile = "./sales.json";

		before(function(done) {
			schema.Schema.remove(dbFile, function(err) {
				done();
			});
		});	

		it('create ' + dbFile, function(done) {
	
			var db = new schema.Schema();
			db.init(salesSchema);
			var allDone = _.after(2, function() {
				done();
			});
			db.write(dbFile, function(err) {
				log.info(err);
				allDone();	
			});
			db.jsonWrite(jsonFile, function(err) {
				log.info(err);
				allDone();	
			});
		});
	});

});


