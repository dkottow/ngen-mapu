
var assert = require('assert')
	, _ = require('underscore')
	, util = require('util')
	, sqlite3 = require('sqlite3').verbose()
	, schema = require('../app/schema')
	, Model = require('../app/model').Model;
	
describe('Schema', function() {

	var testSchema = [
		 { "name": "customers"
		 , "row_name": ["email"]
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
				, "user": {
					  "name": "user"
					, "type": "VARCHAR(64)"
					, "order": 91
				}
				, "date": {
					  "name": "date"
					, "type": "DATETIME"
					, "order": 92
				}
			}		
		 }
	   , { "name": "products"
		 , "row_name": ["name"]		  	
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
				, "user": {
					  "name": "user"
					, "type": "VARCHAR(64)"
					, "order": 3
				}
				, "date": {
					  "name": "date"
					, "type": "DATETIME"
					, "order": 4
				}
			}		
		 }
	   , { "name": "orders"
		 , "row_name": ["order_date", "customers.name"]		  	
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
				, "user": {
					  "name": "user"
					, "type": "VARCHAR(256)"
					, "order": 91
				}
				, "date": {
					  "name": "date"
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
				, "user": {
					  "name": "user"
					, "type": "VARCHAR(256)"
					, "order": 91
				}
				, "date": {
					  "name": "date"
					, "type": "DATETIME"
					, "order": 92
				}
			}		
		 }
	];

	describe('init()', function() {
		it('ctor guards tableDef', function() {
			var db = new schema.Database([
					 {"name": "table_foo"
				}
			]);
			db.init(function(err) {
				console.log(err);
				assert(err instanceof Error);
			});
		});
		it('ctor guards fieldDef', function() {
			var db = new schema.Database([
					 { "name": "test"
					 , "fields": {
							"id": {
								  "name": "id"
								, "type": "foo"
							}
						}		
					 }
			]);
			db.init(function(err) {
				console.log(err);
				assert(err instanceof Error);
			});
		});
		it('ctor guards opbligatory fields', function() {
			var db = new schema.Database([
					 { "name": "test"
					 , "fields": {
							  "id": {
								  "name": "id"
								, "type": "INTEGER"
								, "order": 0
							}
							, "foo": {
								  "name": "foo"
								, "type": "VARCHAR(256)"
								, "order": 1
							}
						}		
					 }
			]);
			db.init(function(err) {
				console.log(err);
				assert(err instanceof Error);
			});
		});
	});
	describe('Database.createSQL()', function() {
		it('createSQL example', function() {
			var db = new schema.Database(testSchema);
			db.init(function(err) {
				if (err) {
					console.log(err);
				} else {
					var sql = db.createSQL();
					//console.log(sql);
				}
			});
		});
	});
	describe('Model.setSchema()', function() {
		var dbFile = "test/test-create.sqlite";
		var model = new Model(dbFile);

		before(function(done) {
			//model.init(done);
			done();
		});

		it('createSQL example', function(done) {
			model.setSchema(testSchema, function(err) {
				console.log(err);
				done();
			});
		});
	});

});


