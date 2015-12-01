
var assert = require('assert')
	, _ = require('underscore')
	, util = require('util')
	, sqlite3 = require('sqlite3').verbose()
	, probdist = require('probdist')
	, Random = require('random-js')
	, schema = require('../app/Schema')
	, database = require('../app/Database');
	
var log = global.log;

//run me from root dir mocha gen_data/create-sandwich-data.js to upload data to sales_sandwich.sqlite

describe('Database', function() {


	describe('create_orders()', function() {
		var dbFile = "gen_data/sales_sandwich.sqlite";
		var db = new database.Database(dbFile);
		var customers;
		var products;
		
		var rand =  new Random(Random.engines.mt19937().autoSeed());
		
		before(function(done) {
			db.init(function(err) {
				if (err) {
					log.info(err);
				} else {
					var allDone = _.after(2, function() {
						done();
					});
					db.all('customers', function(err, result) {
						log.debug('got ' + result.rows.length + " customers.");
						customers = result.rows;
						allDone();
					});
					db.all('products', function(err, result) {
						log.debug('got ' + result.rows.length + " products.");
						products = result.rows;
						allDone();
					});
				}
			});
		});	

		it('create example', function(done) {
			var startDate = new Date('2014-01-01');
			var endDate = new Date('2015-12-01');
			_.times(50, function() {
				console.log(rand.date(startDate, endDate));
			});
			//log.debug(products);
			done();
		});
	});

});


