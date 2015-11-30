
var assert = require('assert')
	, _ = require('underscore')
	, util = require('util')
	, sqlite3 = require('sqlite3').verbose()
	, math = require('math')
	, schema = require('../app/Schema')
	, database = require('../app/Database');
	
var log = global.log;

//run me from root dir mocha etc/create-sandwich-data.js to upload data to sales_sandwich.sqlite

describe('Database', function() {


	describe('create_orders()', function() {
		var dbFile = "etc/sales_sandwich.sqlite";
		var db = new database.Database(dbFile);
		var customers;
		var products;
		
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
			log.debug(products);
			done();
		});
	});

});


