/*
	mocha tests - run me from parent dir
*/
var assert = require('assert')
	, _ = require('underscore')
	, util = require('util')
	, mssql = require('mssql');

global.sql_engine = 'mssql';

var Schema = require('../app/Schema').Schema; 
var DatabaseFactory = require('../app/DatabaseFactory.js').DatabaseFactory;
var Database = require('../app/mssql/DatabaseMssql.js').DatabaseMssql;

var mssql = require('mssql');

var log = require('./log.js').log;

describe('Database', function() {
	var db = DatabaseFactory.create({
		user: 'dkottow', 
		password: 'G0lderPass.72', 
		domain: 'GOLDER',
		server: 'localhost\\HOLEBASE_SI', 
		database: 'demo#sandwiches' 	
	});

	before(function(done) {
//done(); return;
		this.timeout(10000);	
		db.init(function(err) {
			db.readSchema(done);
		});
	});	

	describe('readSchema()', function() {
		it('guards file not found', function(done) {
			var m = DatabaseFactory.create({
				user: 'dkottow', 
				password: 'G0lderPass.72', 
				domain: 'GOLDER',
				server: 'localhost\\HOLEBASE_SI', 
				database: 'test#foo' 					
			});
			m.init(function(err) {
		console.log('call readScehma');
				m.readSchema(function(err) {
					assert(err instanceof Error);
					done();	
				});
			});
		});
	});
	
  	describe('getInfo()', function() {		

		var defs;
		
		before(function(done) {
			db.getInfo(function(err, result) {
				defs = result;
				log.info(defs);
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
			db.getStats('orders', function(err, result) {
				assert(err == null, err);
				log.info(result);
				done();
			});
		});
		it('getStats for orders.total_amount', function(done) {
			db.getStats('orders', { fields: ['total_amount'] }, 
				function(err, result) {
					assert(err == null, err);
					log.info(result);
					done();
				}
			);
		});
	});

  	describe('all()', function() {		

		it('get all customers / products', function(done) {
			var tables = [ 'products', 'customers' ];

			var allDone = _.after(tables.length, done);			

			_.each(tables, function(tn) {

				db.all(tn, function(err, result) {
					assert(err == null, err);
					log.debug('got ' + result.rows.length + " of " 
								+ result.count + " " + tn);
					allDone();
				});
			});
		});

		it('all orders of one customer and smaller than an amount', function(done) {

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
			
			db.all(table, options, function(err, result) {
				assert(err == null, err);
				log.info('got ' + result.count + " " + table);
				assert(result.count > 0, 'got some ' + table);
				done();
			});

		});

		it('all products ordered by a certain customer', function(done) {

			var table = 'products';

			var options = {
					filter : [{
						'table': 'customers', 
						'field': 'name', 
						'op': 'eq', 
						'value': 'Daniel'
					}]
			};

			db.all(table, options, function(err, result) {
				assert(err == null, err);
				log.info('got ' + result.count + " " + table);
				assert(result.count > 0, 'got some ' + table);
				done();
			});

		});

		it('all orders having items with products.id in (1,2,3)', 
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

			db.all(table, options, function(err, result) {
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
r.id = 1000 + i;
				rows.push(r);
			}

			db.insert(table, rows, {}, function(err, result) { 
				assert(err == null, err);
				done(); 
			});
		});

/* TODO not-nullable
		it('fail on 2nd row', function(done) {
			var rows = [
				{
					'order_date': '2015-01-01', 
					'customer_id': 1,
					'total_amount': 10.50,
					'modified_by': 'mocha', 
					'modified_by': '2000-01-01' 
				},
				{
					'order_date': '2015-01-01', 
					'customer_id': 2,
					'total_amount': 9.50,
					'modified_on': '2000-01-01' 
				}
			];				
			db.insert(table, rows, function(err, result) { 
				console.log(err);
				console.log(result);
				assert(err instanceof Error, 'sqlite null constraint holds on 2nd row');
				done();
			});
		});
*/ 

		it('field type mismatch (date)', function(done) {
			var row = {
				'order_date': 'foo', 
				'customer_id': 1,
				'total_amount': 10.50,
				'modified_by': 'mocha', 
				'modified_on': '2000-01-01' 
			};
			db.insert(table, [row], {}, function(err, result) { 
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
			db.insert(table, [row], { retmod: true }, function(err, result) { 
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

			db.update(table, rows, { retmod: true }, function(err, result) { 
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

			db.update(table, [row], {}, function(err, result) { 
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

			db.update(table, [row], {}, function(err, result) { 
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

			db.update(table, [row], {}, function(err, result) { 
				log.info(err);
				assert(err instanceof Error, 'update did not fail');
				done(); 
			});
		});
	});

  	describe('delete()', function() {		

		var table = 'orders';

		it('delete some rows', function(done) {

			db.delete(table, [11, 12, 15], function(err, result) {
				assert(err == null, 'deleted some rows');
				log.info(err);
				done(); 
			});
		});
	});

  	describe('chown()', function() {		

		var table = 'customers';

		it('chown some rows', function(done) {

			db.chown(table, [1], 'new-owner', function(err, result) {
				assert(err == null, 'changed owner of some rows');
				log.info(err);
				done(); 
			});
		});
	});

	describe('Database.remove()', function() {
		var dbConfig = { 
			user: 'dkottow', 
			password: 'G0lderPass.72', 
			domain: 'GOLDER',
			server: 'localhost\\HOLEBASE_SI', 
		};

/*
		it('select information schema', function(done) {

			var sql = 'SELECT TOP (1000) [TABLE_CATALOG], [TABLE_SCHEMA, [TABLE_NAME], [TABLE_TYPE] FROM [master].[INFORMATION_SCHEMA].[TABLES]';

			mssql.connect(dbConfig, err => {
				// ... error checks
				console.log(err);

				new mssql.Request().query(sql, (err, result) => {
					// ... error checks
					console.log(err);
					console.dir(result);
					mssql.close();	
					done();
				});
			});	
		});
*/
		it('remove non-existent database', function(done) {
			this.timeout(10000);
			Database.remove(dbConfig, 'test#foo', function(err) {
				assert(err == null);	
				done();
			});

		});
	});

	describe('Database.writeSchema()', function() {
		//var jsonSalesFile = "test/data/json/sales.json";
		var jsonSalesFile = "Soils08.json";
		var dbConfig = { 
			user: 'dkottow', 
			password: 'G0lderPass.72', 
			domain: 'GOLDER',
			server: 'localhost\\HOLEBASE_SI', 
//			database: 'demo#sandwiches' 
			database: 'jstianson#Soils08' 
		};

		before(function(done) {

			this.timeout(10000);
			Database.remove(dbConfig, dbConfig.database, function(err) {
				done();
			});
		});	

		it('write example', function(done) {
	
			this.timeout(5000);

			var db = DatabaseFactory.create(dbConfig);
			var schema = new Schema();

			schema.jsonRead(jsonSalesFile, function(err) {
				assert(err == null, err);
				db.setSchema(schema.get());
				db.writeSchema(function(err) {
					assert(err == null, err);
					done();	
				});
				
			});
			
		});
	});

});

