
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
		it('ctor adds opbligatory tables and fields', function() {
			var schema = new Schema();
			var schemaData = { 
				tables: [
					 { "name": "test"
					 , "fields": {
							  "id": {
								  "name": "id"
								, "type": "integer"
								, "order": 0
							}
							, "foo": {
								  "name": "foo"
								, "type": "text(256)"
								, "order": 1
							}
						}		
					 }
				]
			};
			try {
				schema.init(schemaData);
				var schemaJSON = schema.get();
				log.trace({ schema: schemaJSON }, 'schema.get()');
				assert(_.values(schemaJSON.tables).length == schemaData.tables.length + Schema.MANDATORY_TABLES.length, 'count mandatory tables');

			} catch(err) {
				log.info(err);
				assert(err instanceof Error);
			}
		});
	});
	
});


