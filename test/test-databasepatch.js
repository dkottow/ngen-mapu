
var assert = require('assert')
	, _ = require('underscore')
	, util = require('util')
	, jsonpatch = require('fast-json-patch');

global.config = global.config || {},
global.config.sql_engine = 'sqlite';

var salesDefs = require('../etc/data/sales-defs.js'); 

var DatabaseFactory = require('../app/DatabaseFactory').DatabaseFactory;
var Database = DatabaseFactory.getClass();

var Field = require('../app/Field').Field;
var Table = require('../app/Table').Table;

var log =  require('./log').log;
var funcs =  require('./utils').funcs;

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

	it('patch table and field props', function(done) {

		var prevSchema = JSON.parse(JSON.stringify(patchDb.schema.get())); 
		//modify schema
		patchDb.table('customers').props.order = 77;
		patchDb.table('products').field('price').props.visible = false;
		patchDb.table('products').field('name').props.order = 100;

		var patches = jsonpatch.compare(prevSchema, patchDb.schema.get());			
		
		patchDb.patchSchema(patches, function(err, schema) {
			assert(err == null && schema.tables.customers.props.order == 77
				, 'error setting table properties');
			assert(schema.tables.products.fields.price.props.visible == false 
				&& schema.tables.products.fields.name.props.order == 100
				, 'error setting field properties');

			log.trace({schema: patchDb.schema.get()}, 
				"schema after failing to write patches");
			done();				
		});
	
	});

	it('patch add table', function(done) {

		var prevSchema = JSON.parse(JSON.stringify(patchDb.schema.get())); 

		//we cannot add table directly to patchDb obj.. instead take another JSON copy and add table json to it
		var newSchema = JSON.parse(JSON.stringify(patchDb.schema.get())); 
		var newTable = new Table({ name: 'PatchTest' });
		newSchema.tables[newTable.name] = newTable.toJSON();

		var patches = jsonpatch.compare(prevSchema, newSchema);			
		
		patchDb.patchSchema(patches, function(err, schema) {
			assert(schema.tables['PatchTest'].fields.id
				, 'could not add table PatchTest');

			log.trace({schema: patchDb.schema.get()}, 
				"schema after failing to write patches");
			done();				
		});
	
	});

	it('patch add field', function(done) {

		var prevSchema = JSON.parse(JSON.stringify(patchDb.schema.get())); 
		//modify schema
		patchDb.table('products').addField(new Field({ name: 'foo', type: 'text' }));

		var patches = jsonpatch.compare(prevSchema, patchDb.schema.get());			
		
		patchDb.patchSchema(patches, function(err, schema) {
			assert(schema.tables.products.fields['foo'].type == 'text'
				, 'could not add field foo of type text');
			log.trace({schema: patchDb.schema.get()}, 
				"schema after failing to write patches");
			done();				
		});
	
	});


});

