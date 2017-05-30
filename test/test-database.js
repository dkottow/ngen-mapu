/*
	mocha tests - run me from parent dir
*/
var assert = require('assert')
	, _ = require('underscore')
	, path = require('path')
	, util = require('util');

global.config = global.config || {},
global.config.sql_engine = 'sqlite';
//global.config.sql_engine = 'mssql';

global.config.data_dir = path.join(process.cwd(), 'data');

global.config.mssql_connection = {
	user: 'dkottow', 
	password: '', 
	domain: 'GOLDER',
	server: 'localhost\\HOLEBASE_SI', 
};

//global.config = { loglevel : 'info' };

var DatabaseFactory = require('../app/DatabaseFactory').DatabaseFactory;
var Database = DatabaseFactory.getClass();

var Schema = require('../app/Schema').Schema; //only for some static var
var Field = require('../app/Field').Field; //only for some static var

var salesDefs = require('../etc/data/sales-defs.js'); 

var log = require('./log.js').log;
var funcs = require('./utils.js').funcs;

describe('Database', function() {
	var database;

	before(function(done) {
		this.timeout(10000); //10secs
		funcs.createDatabase('temp-sales', salesDefs, function(err, db) {
			if ( ! db) return; //db is null first time.. weird. 
			database = db;
			done();
		});
	});

	describe('readSchema()', function() {
		it('guards file not found', function(done) {
			var m = DatabaseFactory.create("file-not-found.sqlite");
			m.readSchema(function(err) {
				assert(err instanceof Error);
				done();	
			});
		});
	});
	
  	describe('getInfo()', function() {		

		var defs;
		
		before(function(done) {
			database.getInfo(function(err, result) {
				defs = result;
				//log.info(defs);
				done();
			});
			//console.log(defs);
		});

		it('sales.sqlite has 4 tables', function() {
			//console.log(_.values(defs.tables));
			assert.equal(_.values(defs.tables).length, 4);
		});

		it('sales.sqlite has products table with some fields', function() {
			var products = _.find(defs.tables, function(t) { return t.name == "products" });
			assert(products, 'table exists');
			assert(_.values(products.fields).length > 3, 'fields exists');
			assert.equal(products.referenced.length, 1, 'one referenced table');
		});

	});

  	describe('getStats()', function() {		
		it('getStats for orders', function(done) {
			database.getStats('orders', function(err, result) {
				assert(err == null, err);
				log.info(result);
				done();
			});
		});
		it('getStats for orders.total_amount', function(done) {
			database.getStats('orders', { fields: ['total_amount'] }, 
				function(err, result) {
					assert(err == null, err);
					log.info(result);
					done();
				}
			);
		});
	});

  	describe('all()', function() {		

		it('get all customers/products', function(done) {
			var tables = [ 'products', 'customers' ];

			var allDone = _.after(tables.length, done);			

			_.each(tables, function(tn) {

				database.all(tn, function(err, result) {
					assert(err == null, err);
					log.debug('got ' + result.rows.length + " of " 
								+ result.count + " " + tn.name);
					assert(result.count > 0, 'got some ' + tn.name);
					allDone();
				});
			});

		});

		it('all orders filtered by customer and limited amount', function(done) {

			var table = 'orders';

			var options = {
				filter : [
					{   'table': 'customers', 
						'field': 'name', 
						'op': 'eq', 
						'value': 'Daniel'
					},
					{	'field': 'total_amount', 
						'op': 'le', 
						'value': 100
					}
				],
				limit: 10
			};
			
			database.all(table, options, function(err, result) {
				assert(err == null, err);
				log.info('got ' + result.count + " " + table);
				assert(result.count > 0, 'got some ' + table);
				done();
			});

		});

		it('all products ordered filtered by customer', function(done) {

			var table = 'products';

			var options = {
					filter : [{
						'table': 'customers', 
						'field': 'name', 
						'op': 'eq', 
						'value': 'Daniel'
					}]
			};

			database.all(table, options, function(err, result) {
				assert(err == null, err);
				log.info('got ' + result.count + " " + table);
				assert(result.count > 0, 'got some ' + table);
				done();
			});

		});

		it('all orders filtered by products.id in (1,2,3)', 
		function(done) {

			var table = 'orders';

			var options = {
				filter : [{
					'table': 'products', 
					'field': 'id', 
					'op': 'in', 
					'value': [1,2,3]
				}]
			};

			database.all(table, options, function(err, result) {
				assert(err == null, err);
				log.info('got ' + result.count + " " + table);
				assert(result.count == 4, 'got 4 ' + table);
				done();
			});
		});

	});

  	describe('insert()', function() {		

		var table = 'orders';

		it('100 rows', function(done) {

			this.timeout(10000); //10secs

			var rows = [];
			var row = {
				'order_date': '2015-01-01', 
				'customer_id': 1,
				'total_amount': 10.50,
				'modified_by': 'mocha', 
				'modified_on': '2000-01-01' 
			};

			for(var i = 1;i < 100; ++i) {
				var r = _.clone(row);
				r.customer_id = _.sample([1,2]);
				r.total_amount = Math.round(1000*Math.random(), 2);
				rows.push(r);
			}

			database.insert(table, rows, {}, function(err, result) { 
				assert(err == null, err);
				done(); 
			});
		});

		it('field type mismatch (date)', function(done) {
			var row = {
				'order_date': 'foo', 
				'customer_id': 1,
				'total_amount': 10.50,
				'modified_by': 'mocha', 
				'modified_on': '2000-01-01' 
			};
			database.insert(table, [row], {}, function(err, result) { 
				log.info(err);
				assert(err instanceof Error, 'sqlite check constraint holds');
				done();
			});
		});

		it('insert with specific id', function(done) {
			var row = {
				'id': 666, 
				'order_date': '2000-01-01', 
				'customer_id': 1,
				'total_amount': 66.66,
				'modified_by': 'mocha', 
				'modified_on': '2000-01-01' 
			};
			database.insert(table, [row], { retmod: true }, function(err, result) { 
				log.info(err);
				assert(err == null, 'sqlite insert specific id');
				assert(result.rows[0].id == row.id);
				done();
			});
		});
	});

  	describe('update()', function() {		

		var table = 'orders';

		it('some rows', function(done) {

			var rows = [];
			var row = {
				'id': 0,
				'order_date': '2015-01-02', 
				'customer_id': 1,
				'total_amount': 2.00,
				'modified_by': 'mocha', 
				'modified_on': '2001-01-01' 
			};

			for(var i = 5; i < 20; ++i) {
				var r = _.clone(row);
				r.id = i;
				r.total_amount = i*10 + 0.5;
				rows.push(r);
			}

			database.update(table, rows, { retmod: true }, function(err, result) { 
				assert(err == null, 'update some rows');
				assert(result.rows.length == rows.length);
				done(); 
			});
		});

		it('row does not exist', function(done) {

			var row = {
				'id': 888,
				'order_date': '2015-01-02', 
				'customer_id': 1,
				'total_amount': 2.00,
				'modified_by': 'mocha', 
				'modified_on': '2001-01-01' 
			};

			database.update(table, [row], {}, function(err, result) { 
				log.info(err);
				assert(err instanceof Error, 'row does not exist');
				done(); 
			});
		});

		it('field type mismatch (numeric)', function(done) {

			var row = {
				'id': 666,
				'order_date': '2015-01-02', 
				'customer_id': 1,
				'total_amount': 'foo',
				'modified_by': 'mocha', 
				'modified_on': '2001-01-01' 
			};

			database.update(table, [row], {}, function(err, result) { 
				log.info(err);
				assert(err instanceof Error, 'update did not fail');
				done(); 
			});
		});


		it('unknown foreign key', function(done) {

			var row = {
				'id': 5,
				'order_date': '2015-01-02', 
				'customer_id': 666,
				'total_amount': 2.00,
				'modified_by': 'mocha', 
				'modified_on': '2001-01-01' 
			};

			database.update(table, [row], {}, function(err, result) { 
				log.info(err);
				assert(err instanceof Error, 'update did not fail');
				done(); 
			});
		});
	});

  	describe('delete()', function() {		

		var table = 'orders';

		it('delete some rows', function(done) {

			database.delete(table, [11, 12, 15], function(err, result) {
				assert(err == null, 'deleted some rows');
				log.info(err);
				done(); 
			});
		});
	});

  	describe('chown()', function() {		

		var table = 'customers';

		it('chown some rows', function(done) {

			database.chown(table, [1], 'new-owner', function(err, result) {
				assert(err == null, 'changed owner of some rows');
				log.info(err);
				done(); 
			});
		});
	});

	describe('Database.schemaWrite()', function() {
		var jsonSalesFile = "test/data/json/sales.json";
		var newDb;

		before(function(done) {			

			funcs.createDatabase('temp-create', function(err, db) {
				if ( ! db) return;
				newDb = db;
				done();
			});	
		});	

		it('write example', function(done) {
	
			this.timeout(10000); //10secs
			var schema = new Schema();

			schema.jsonRead(jsonSalesFile, function(err) {
				log.info(err);
				assert(err == null, err);
				newDb.setSchema(schema.get());
				newDb.writeSchema(function(err) {
					log.info(err);
					assert(err == null, err);
					done();	
				});
				
			});
			
		});
	});

});

