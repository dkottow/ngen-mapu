
var assert = require('assert')
	, _ = require('underscore')
	, util = require('util')
	, sqlite3 = require('sqlite3').verbose()
	, schema = require('../app/schema')
	, Model = require('../app/model').Model;
	
describe('Schema', function() {

	var testSchema = [
		 { "name": "customer"
		 , "fields": {
				  "id": {
					  "name": "id"
					, "type": "INTEGER"
					, "order": 0
				}
				, "name": {
					  "name": "name"
					, "type": "VARCHAR"
					, "order": 2
					, "natural_key": 1
				}
				, "user": {
					  "name": "user"
					, "type": "VARCHAR(256)"
					, "order": 3
				}
				, "date": {
					  "name": "date"
					, "type": "DATETIME"
					, "order": 4
				}
			}		
		 }
	   , { "name": "simple_order"
		 , "parent": "customer"		  	
		 , "fields": {
				  "id": {
					  "name": "id"
					, "type": "INTEGER"
					, "order": 0
				}
				, "customer_pid": {
					  "name": "customer_pid"
					, "type": "INTEGER"
					, "order": 1
				}
				, "price": {
					  "name": "price"
					, "type": "NUMERIC(6,3)"
					, "order": 2
				}
				, "user": {
					  "name": "user"
					, "type": "VARCHAR(256)"
					, "order": 3
				}
				, "date": {
					  "name": "date"
					, "type": "DATETIME"
					, "order": 4
				}
			}		
		 }
	   , { "name": "sales_order"
		 , "supertype": "simple_order"		  	
		 , "fields": {
				  "id": {
					  "name": "id"
					, "type": "INTEGER"
					, "order": 0
				}
				, "sale_price": {
					  "name": "sale_price"
					, "type": "NUMERIC(6,3)"
					, "order": 2
				}
				, "user": {
					  "name": "user"
					, "type": "VARCHAR(256)"
					, "order": 3
				}
				, "date": {
					  "name": "date"
					, "type": "DATETIME"
					, "order": 4
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


