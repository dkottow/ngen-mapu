
var assert = require('assert')
	, _ = require('underscore')
	, util = require('util')
	, path = require('path')
	, jsonpatch = require('fast-json-patch');

global.config = global.config || {},
global.config.sql_engine = 'sqlite';
//global.config.sql_engine = 'mssql';
global.config.data_dir = path.join(process.cwd(), 'data');

global.config.mssql_connection = {
	user: 'dkottow', 
	password: 'G0lderPass.72', 
	domain: 'GOLDER',
	server: 'localhost\\HOLEBASE_SI', 
};

var salesDefs = require('../etc/data/sales-defs.js'); 

var DatabaseFactory = require('../app/DatabaseFactory').DatabaseFactory;
var Database = DatabaseFactory.getClass();

var Field = require('../app/Field').Field;
var Table = require('../app/Table').Table;

var log =  require('./log').log;
var funcs =  require('./utils').funcs;

describe('Database.patchSchema', function() {
	var patchDb;
	var oldSchema, newSchema;

	before(function(done) {
		this.timeout(10000); //10secs
		delete salesDefs.data;
		funcs.createDatabase('temp-patches', salesDefs, function(err, db) {
			if ( ! db) return; //db is null first time.. weird. 
			patchDb = db;
			done();	
		});			
	});

	beforeEach(function() {
		//work on a JSON level: modify newSchema first, then do a json diff and patch db with it.
		oldSchema = JSON.parse(JSON.stringify(patchDb.schema.get())); 
		newSchema = JSON.parse(JSON.stringify(patchDb.schema.get())); 
	});

	it('patch table and field props', function(done) {

		//modify schema
		newSchema.tables['customers'].props.order = 77;
		newSchema.tables['products'].fields['price'].props.visible = false;
		newSchema.tables['products'].fields['name'].props.order = 100;

		var patches = jsonpatch.compare(oldSchema, newSchema);			
		
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

	it('add table', function(done) {

		var newTable = new Table({ name: 'PatchTest' });
		newSchema.tables[newTable.name] = newTable.toJSON();

		var patches = jsonpatch.compare(oldSchema, newSchema);			
		
		patchDb.patchSchema(patches, function(err, schema) {
			assert(schema.tables['PatchTest'].fields.id
				, 'could not add table PatchTest');

			log.trace({schema: patchDb.schema.get()}, 
				"schema after failing to write patches");
			done();				
		});
	
	});

	it('add field', function(done) {

		var newField = new Field({ name: 'foo', type: 'text' });
		newSchema.tables['products'].fields[newField.name] = newField.toJSON();

		var patches = jsonpatch.compare(oldSchema, newSchema);			
		
		patchDb.patchSchema(patches, function(err, schema) {
			assert(schema.tables.products.fields['foo'].type == 'text'
				, 'could not add field foo of type text');
			log.trace({schema: patchDb.schema.get()}, 
				"schema after failing to write patches");
			done();				
		});
	
	});

	it('set table', function(done) {
		//var newTable = new Table({ name: 'products' });
		delete newSchema.tables['products'].fields['price'];
		var patches = jsonpatch.compare(oldSchema, newSchema);			
console.dir(patches);		
		patchDb.patchSchema(patches, function(err, schema) {
			assert(schema.tables['orders'], 'could not set table orders');
			log.trace({schema: patchDb.schema.get()}, 
				"schema after failing to write patches");
			done();				
		});
	});

	it('del table', function(done) {
		var tableName = 'orders';
		delete newSchema.tables[tableName];
		var patches = jsonpatch.compare(oldSchema, newSchema);			
		
		patchDb.patchSchema(patches, function(err, schema) {
			assert( ! schema.tables[tableName], 'could not del table ' + tableName);
			log.trace({schema: patchDb.schema.get()}, 
				"schema after failing to write patches");
			done();				
		});
	});

});

