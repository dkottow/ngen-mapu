
var assert = require('assert')
	, _ = require('underscore')
	, util = require('util')
	, sqlite3 = require('sqlite3').verbose();
	
global.log = require('./create_log.js').log;
	
var Schema = require('../app/Schema').Schema;
	
var log =  require('../app/log').log;

describe('Schema', function() {
	var jsonSalesFile = "test/data/json/sales.json";
	var dbFile = "test/data/sqlite/test-create.sqlite";

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
	
	describe('Schema.write()', function() {
		
		before(function(done) {
			Schema.remove(dbFile, function(err) {
				done();
			});
		});	

		it('write example', function(done) {
	
			var schema = new Schema();
			schema.jsonRead(jsonSalesFile, function(err) {
				log.info(err);
				assert(err == null, err);
				schema.write(dbFile, function(err) {
					log.info(err);
					done();	
				});
			});

		});
	});

	describe('Schema.patch()', function() {
		var schema = new Schema();

		before(function(done) {
			schema.jsonRead(jsonSalesFile, function(err) {
				log.info(err);
				assert(err == null, err);
				done();
			});
		});

		it('parse prop patch', function(done) {
	
			var patch = {
				op: Schema.PATCH_OPS.SET_PROP
				, path: '/TableFoo/FieldBar/width'
				, value: 50
			}
			try {
				var p = schema.parsePatch(patch);
				log.info(p);
				assert(false);				

			} catch(ex) {
				log.error(ex);
				assert(ex instanceof Error);
				done();
			};
		});

		it('parse user patch', function(done) {
	
			var patch = {
				op: Schema.PATCH_OPS.SET_USER
				, path: 'daniel'
				, value: 'owner'
			}
			try {
				var p = schema.parsePatch(patch);
				log.info(p);
				assert(false);				

			} catch(ex) {
				log.error(ex);
				assert(ex instanceof Error);
				done();
			};
		});

		it('patch field width', function(done) {
	
			var patch = {
				op: Schema.PATCH_OPS.SET_PROP
				, path: '/customers/email/width'
				, value: 90
			}

			schema.patch(patch);
			log.info({schema: schema.get()}, "schema after patch");
			done();				
		});

		it('patch table prop order on all tables', function(done) {
	
			var tables = schema.tableArray();

			_.each(tables, function(t, idx) {
				var p = {
					op: Schema.PATCH_OPS.SET_PROP
					, path: '/' + t.name + '/order'
					, value: idx
				}
				schema.patch(p);
			});
			
			log.info({schema: schema.get()}, "schema after patch");
			done();				
		});

		it('write prop patches', function(done) {
	
			var tables = _.sortBy(schema.tables(), function(t) {
				return t.name;
			});

			var patches = _.map(tables, function(t, idx) {
				return {
					op: Schema.PATCH_OPS.SET_PROP
					, path: '/' + t.name + '/order'
					, value: idx
				}
			});
			patches.push({
				op: Schema.PATCH_OPS.SET_PROP
				, path: '/orders/customer_id/width'
				, value: 44
			});

			_.each(patches, function(p) {
				schema.patch(p);
			});			

			schema.writePatches(dbFile, patches, function(err) {
				assert(err == null, err);
				log.info({schema: schema}, "schema after writing patches");
				done();				
			});

		});

		it('write user patch', function(done) {
	
			var patch = {
				op: Schema.PATCH_OPS.SET_USER
				, path: '/user/dfw@donkeylift.com'
				, value: { role: Schema.USER_ROLES.WRITER }
			}

			schema.patch(patch);

			schema.writePatches(dbFile, [patch], function(err) {
				assert(err == null, err);
				log.info({schema: schema}, "schema after writing patches");
				done();				
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
			var schema = new Schema(selfRefSchema);

			schema.init(function(err) {
				if (err) {
					log.info(err);
				} else {
					var sql = schema.createSQL();
					//log.info(sql);

					schema.create('selfref.sqlite', function(err) {
						log.info(err);
						done();	
					});

				}
			});
		});
*/

	});
});


