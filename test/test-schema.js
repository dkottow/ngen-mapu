
var assert = require('assert')
	, _ = require('underscore')
	, util = require('util')
	, sqlite3 = require('sqlite3').verbose()
	, schema = require('../app/Schema')
	, Model = require('../app/Database').Database;
	
var log = global.log;

describe('Schema', function() {

	var testSchema = [
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

	describe('init()', function() {
		it('ctor guards tableDef', function() {
			var db = new schema.Schema([
					 {"name": "table_foo"
				}
			]);
			db.init(function(err) {
				log.info(err);
				assert(err instanceof Error);
			});
		});
		it('ctor guards fieldDef', function() {
			var db = new schema.Schema([
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
				log.info(err);
				assert(err instanceof Error);
			});
		});
		it('ctor guards opbligatory fields', function() {
			var db = new schema.Schema([
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
				log.info(err);
				assert(err instanceof Error);
			});
		});
	});
	
	describe('Database.create()', function() {
		var dbFile = "test/test-create.sqlite";
		
		before(function(done) {
			var db = new schema.Schema(testSchema);
			schema.Schema.remove(dbFile, function(err) {
				done();
			});
		});	

		it('createSQL example', function() {
			var db = new schema.Schema(testSchema);

/*
db.init(function(err) {
console.log(db.createSQL());
return;
});
*/

			db.init(function(err) {
				if (err) {
					log.info(err);
				} else {
					var sql = db.createSQL();
					//console.log(sql);
				}
			});
		});

		it('create example', function(done) {
	
			var db = new schema.Schema(testSchema);
			db.init(function(err) {
				if (err) {
					log.info(err);
				} else {
					db.create(dbFile, function(err) {
						log.info(err);
						done();	
					});
				}
			});

		});
	});

	describe('Database.update()', function() {
		var dbFile = "test/test-create.sqlite";

/*
		it('drop_table example', function(done) {
	
			var db = new schema.Schema();
			db.read(dbFile, function(err) {
				if (err) {
					log.info("ERROR ++++ ");
					log.info(err);
				} else {
					var customers = db.tables['customers'].toJSON();
					db.drop_table('customers', dbFile, function(err) {
						assert(err == null);
						db.add_table(customers, dbFile, function(err) {
							assert(err == null, err);
							done();	
						});
					});
				}
			});
		});
*/

		it('update example', function(done) {
	
			var db = new schema.Schema();
			db.read(dbFile, function(err) {
				if (err) {
					log.info("ERROR ++++ ");
					log.info(err);
				} else {
					var delTables = [
						{ name: 'customers' }, 
						{ name: 'orders'}
					];
					var addTables = [
						db.tables['customers'].toJSON(),
						db.tables['orders'].toJSON()
					];
					addTables[0].name = 'cus';
					addTables[1].fields['customer_id'].fk_table = 'cus';
					addTables[1].row_alias = ['order_date', 'cus.name'];

					db.update(delTables, addTables, dbFile, function(err) {
						log.info(err);
						done();	
					});
				}
			});
		});

	});

	describe('Database with selfReferential tables', function() {

		var selfRefSchema = [
			 { "name": "employees"
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
					, "supervisor_id": {
						  "name": "supervisor_id"
						, "type": "INTEGER"
						, "fk_table": "employees"
						, "order": 2
					}
/*					
					, "councellor_id": {
						  "name": "councellor_id"
						, "type": "INTEGER"
						, "fk_table": "employees"
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
			 }];

/* TODO
		it('self ref example', function(done) {
			var db = new schema.Schema(selfRefSchema);

			db.init(function(err) {
				if (err) {
					log.info(err);
				} else {
					var sql = db.createSQL();
					//log.info(sql);

					db.create('selfref.sqlite', function(err) {
						log.info(err);
						done();	
					});

				}
			});
		});
*/

	});
});


