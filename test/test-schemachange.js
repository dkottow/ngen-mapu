
var assert = require('assert')
	, _ = require('underscore')
	, util = require('util')
	, fsext = require('fs-extra')
	, sqlite3 = require('sqlite3').verbose()
	, jsonpatch = require('fast-json-patch');

global.sql_engine = 'sqlite';

var Schema = require('../app/Schema').Schema;
var SchemaChange = require('../app/SchemaChange').SchemaChange;
	
var Field = require('../app/Field').Field;
var Table = require('../app/Table').Table;

var salesDefs = require('../etc/data/sales-defs.js'); 

var DatabaseFactory = require('../app/DatabaseFactory').DatabaseFactory;
var Database = DatabaseFactory.getClass();

var log =  require('./log').log;
var funcs =  require('./utils').funcs;

describe('SchemaChange', function() {
	var jsonSalesFile = "test/data/json/sales.json";

	describe('SchemaChange.create()', function() {
		var schema = new Schema();
		var orgJSON;

		beforeEach(function(done) {
			schema.jsonRead(jsonSalesFile, function(err) {
				assert(err == null, err);
				orgJSON = schema.get();
				done();
			});
		});

		it('change table prop', function(done) {
	
			schema.table('customers').props.order = 99;
			schema.table('customers').props.foo = 'bar';
			var patches = jsonpatch.compare(orgJSON, schema.get());		
			log.debug({patches: patches});

			var changes = SchemaChange.create(patches, schema);
			log.info({changes: changes});

			assert(changes.length == 1 
				&& changes[0].op == SchemaChange.OPS.SET_PROP_TABLE
				, 'expected one set_table_prop change, got ' + changes);
			
			assert(changes[0].path == '/customers/props'
				, 'expected /customers/props path, got ' + changes[0].path);

			done();
		});

		it('change field prop', function(done) {
	
			schema.table('customers').field('name').props.width = 99;
			var patches = jsonpatch.compare(orgJSON, schema.get());		
			log.debug({patches: patches});

			var changes = SchemaChange.create(patches, schema);
			//log.info({op: change.op, path: change.path});

			assert(changes[0].op == SchemaChange.OPS.SET_PROP_FIELD
				, 'expected set_field_prop, got ' + changes);
			assert(changes[0].path == '/customers/name/props'
				, 'expected /customers/name/props path, got ' + changes[0].path);

			done();
		});

		it('change unknown', function(done) {
	
			var newJSON = JSON.parse(JSON.stringify(orgJSON));
			newJSON.foo = 99;
			var patches = jsonpatch.compare(orgJSON, newJSON);		
			log.debug({patches: patches});

			try {
				var changes = SchemaChange.create(patches, schema);
				log.debug({changes: changes});
				assert(false, 'should have thrown ex');

			} catch(err) {
				log.debug({err: err});
				assert(err, 'no change for schema.foo attribute');
			}

			done();
		});

		it('add field', function(done) {

			var field = Field.create({ name: 'test', type: Field.TYPES.text });
			schema.table('customers').addField(field);	
	
			var patches = jsonpatch.compare(orgJSON, schema.get());		
			log.debug({patches: patches});

			var changes = SchemaChange.create(patches, schema);
			//log.info({op: change.op, path: change.path});

			assert(changes[0].op == SchemaChange.OPS.ADD_FIELD
				, 'expected add_field, got ' + changes);
			assert(changes[0].path == '/customers/test'
				, 'expected /customers/test path, got ' + changes[0].path);

			done();
		});

		it('add table', function(done) {

			var table = new Table({ name: 'test' });
			schema.addTable(table);	
	
			var patches = jsonpatch.compare(orgJSON, schema.get());		
			log.debug({patches: patches});

			var changes = SchemaChange.create(patches, schema);
			//log.info({op: change.op, path: change.path});

			assert(changes[0].op == SchemaChange.OPS.ADD_TABLE
				, 'expected add_table, got ' + changes);
			assert(changes[0].path == '/test'
				, 'expected /test path, got ' + changes[0].path);

			done();	

		});

	});


	describe('Database.patchSchema', function() {
		var patchDb;

		before(function(done) {
			this.timeout(10000); //10secs
			funcs.createDatabase('temp-patches', salesDefs, function(err, db) {
				if ( ! db) return; //db is null first time.. weird. 
				patchDb = db;
				done();	
			});			
		});

		it('patch a database', function(done) {
	
			var prevSchema = JSON.parse(JSON.stringify(patchDb.schema.get())); 
			//modify schema
			patchDb.table('customers').props.order = 77;
			patchDb.table('products').addField(new Field({ name: 'foo', type: 'VARCHAR' }));

			var patches = jsonpatch.compare(prevSchema, patchDb.schema.get());			
			
			patchDb.patchSchema(patches, function(err, schema) {
				assert(err == null && schema.tables.customers.props.order == 77
					, 'could not set table props order = 77');
				assert(schema.tables.products.fields['foo'].type == 'VARCHAR'
					, 'could not add field foo of type VARCHAR');
				log.trace({schema: patchDb.schema.get()}, 
					"schema after failing to write patches");
				done();				
			});
		
		});
	
	});


});


