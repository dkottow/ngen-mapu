
var assert = require('assert')
	, _ = require('underscore')
	, util = require('util')
	, sqlite3 = require('sqlite3').verbose()
	, jsonpatch = require('fast-json-patch');

var Schema = require('../app/Schema').Schema;
var SchemaChange = require('../app/SchemaChange').SchemaChange;
	
var log =  require('./log').log;

describe('SchemaChange', function() {
	var jsonSalesFile = "test/data/json/sales.json";
	var dbFile = "test/data/sqlite/test-create.sqlite";

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

			var change = SchemaChange.create(patches[0], schema);
			//log.info({op: change.op, path: change.path});

			assert(change.op == SchemaChange.OPS.SET_PROP_TABLE
				, 'expected set_table_prop, got ' + change.op);
			assert(change.path == '/customers/props'
				, 'expected /customers/props path, got ' + change.path);

			done();
		});

		it('change field prop', function(done) {
	
			schema.table('customers').field('name').props.width = 99;
			var patches = jsonpatch.compare(orgJSON, schema.get());		
			log.debug({patches: patches});

			var change = SchemaChange.create(patches[0], schema);
			//log.info({op: change.op, path: change.path});

			assert(change.op == SchemaChange.OPS.SET_PROP_FIELD
				, 'expected set_field_prop, got ' + change.op);
			assert(change.path == '/customers/name/props'
				, 'expected /customers/name/props path, got ' + change.path);

			done();
		});
	});
});


