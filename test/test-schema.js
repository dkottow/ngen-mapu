
var assert = require('assert')
	, _ = require('underscore')
	, util = require('util')
	, sqlite3 = require('sqlite3').verbose();

	
var Schema = require('../app/Schema').Schema;
	
var log = require('./log.js').log;

describe('Schema', function() {
	var jsonSalesFile = "test/data/json/sales.json";

	describe('Schema.init()', function() {
		it('ctor guards tableDef', function() {
			var schema = new Schema();
			var schemaData = { tables: [ {"name": "table_foo"} ]};
			try {
				schema.init(schemaData);
				assert(false); //init() should throw before here

			} catch(err) {
				log.info(err);
				assert(err instanceof Error);
			}
		});
		it('ctor guards fieldDef', function() {
			var schema = new Schema();
			var schemaData = {
				tables: [
					 { "name": "test"
					 , "fields": {
							"id": {
								  "name": "id"
								, "type": "foo"
							}
						}		
					 }
				]
			};					
			try {
				schema.init(schemaData);
				assert(false); //init() should throw before here

			} catch(err) {
				log.info(err);
				assert(err instanceof Error);
			}
		});
		it('ctor guards opbligatory fields', function() {
			var schema = new Schema();
			var schemaData = { 
				tables: [
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
				]
			};
			try {
				schema.init(schemaData);
				assert(false);

			} catch(err) {
				log.info(err);
				assert(err instanceof Error);
			}
		});
	});
	
});


