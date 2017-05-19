
var assert = require('assert')
	, _ = require('underscore')
	, util = require('util')
	, jsonpatch = require('fast-json-patch');

global.sql_engine = 'mssql';

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

