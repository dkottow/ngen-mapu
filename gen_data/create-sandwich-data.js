
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
			this.timeout(20000);
			var startDate = new Date('2014-01-01');
			var endDate = new Date('2015-12-01');
			var orders = [];

			_.each(customers, function(c) {
				//randomize or not
				c = rand.pick(customers);

				console.log('processing ' + c.name);
				var date = rand.date(startDate, endDate);

				var products_in_order = [];
				var n = Math.max(1, rand.integer(-3, 5)); 

				_.times(n, function() {
					var p = rand.pick(products);
					var po = {
						product_id: p.id,
						unit_price: p.price,
						quantity: 1 + 1*(rand.integer(1, 5) > 3),
						modified_by: 'www',
						modified_on: date.toISOString().replace('T', ' ')
					}
					products_in_order.push(po);
				});

				var total = Math.round(_.reduce(products_in_order, function(t, po) {
					return t + po.quantity * po.unit_price;
				}, 0) * 100) / 100;

				var order = {
					order_date: date.toISOString().substr(0,10),
					customer_id: c.id,
					total_amount: total,
					modified_by: 'www',
					modified_on: date.toISOString().replace('T', ' ')
				}
				
				order.products = products_in_order;

				orders.push(order);
			});

			var products_in_orders = [];

			db.insert('orders', orders, function(err, ids) {
				if (err) {
					console.log(err);
					done();
				} else {
					console.log('inserted orders... ' + ids.length);
				}
					
				for(var i = 0;i < orders.length; ++i) {
					_.each(orders[i].products, function(po) {
						po.order_id = ids[i];
					});
					products_in_orders =
						products_in_orders.concat(orders[i].products);
				}


				db.insert('products_in_orders', products_in_orders, 
					function(err, ids) {
					if (err) {
						console.log(err);
						done();
					} else {
						console.log('inserted products_in_orders... ' 
									+ ids.length);
					}
					done();
				});
					

				
				//console.log(order);
				//console.log(items);

			});
			//log.debug(products);
			//done();
		});
	});

});


