
var APP_PATH = "../../app/";

var assert = require('assert')
	, _ = require('underscore')
	, util = require('util')
	, sqlite3 = require('sqlite3').verbose()
	, probdist = require('probdist')
	, Random = require('random-js')
	, schema = require(APP_PATH + 'Schema')
	, database = require(APP_PATH + 'Database');
	
var log = global.log;

//run me from root dir mocha gen_data/create-sandwich-data.js to upload data to sales_sandwich.sqlite

describe('Database', function() {

	describe('create_orders()', function() {

		var dbFile = "sandwiches.sqlite";
		var db = new database.Database(dbFile);
		var customers;
		var sandwiches;
		
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
					db.all('sandwiches', function(err, result) {
						log.debug('got ' + result.rows.length + " sandwiches.");
						sandwiches = result.rows;
						allDone();
					});
				}
			});
		});	

		it('create orders', function(done) {
			this.timeout(90000);

			var startDate = new Date('2014-01-01');
			var endDate = new Date('2015-12-01');
			
			var orders = generateOrders(200, {
				start_date: startDate,
				end_date: endDate,
			});
			
			generateOrders(500, {
				orders: orders,
				start_date: startDate,
				end_date: endDate,
				sample_size_customers: 50,
				sample_size_sandwiches: 50,
			});
			
			generateOrders(500, {
				orders: orders,
				start_date: startDate,
				end_date: endDate,
				sample_size_customers: 10,
				sample_size_sandwiches: 10,
			});

			var peakStartDate = rand.date(startDate, endDate);
			var peakEndDate = new Date(peakStartDate);
			peakEndDate.setMonth(peakEndDate.getMonth() + 3);

			generateOrders(300, {
				orders: orders,
				sample_size_customers: 30,
				sample_size_sandwiches: 30,
				start_date: peakStartDate,
				end_date: peakEndDate
			});


			saveOrders(orders, done);
			
		});


		var rand =  new Random(Random.engines.mt19937().autoSeed());

		function randBetweenGauss(min, max, sigma) {
			var pg = probdist.gaussian(0, sigma);
			var s = min + Math.abs(pg.sample(1));
			//console.log(s);
			return Math.min(Math.max(min, Math.round(s)), max);
		}

		function generateOrders(nOrders, options) {
			console.log("generateOrders " + nOrders);
			options = options || {};

			var startDate = options.start_date || new Date('2014-01-01');
			var endDate = options.end_date || new Date('2015-12-01');

			var selectedCustomers = options.sample_size_customers 
				? rand.sample(customers, options.sample_size_customers) : customers;

			var selectedProducts = options.sample_size_sandwiches
				? rand.sample(sandwiches, options.sample_size_sandwiches) : sandwiches;

			var maxItemsPerOrder = options.max_items_per_order || 8; 

			var orders = options.orders || [];
			_.times(nOrders, function() {
		
				//random customer
				var c = rand.pick(selectedCustomers);

				//console.log('processing ' + c.name);
				var date = rand.date(startDate, endDate);
				var modDate = date.toISOString().substr(0,19).replace('T', ' ');

				var order_items = [];
				var itemsCount = randBetweenGauss(1, maxItemsPerOrder, 3); 
				//console.log("order items count " + itemsCount);
				_.times(itemsCount, function() {
					var p = rand.pick(selectedProducts);
					var po = {
						sandwich_id: p.id,
						unit_price: p.price,
						quantity: randBetweenGauss(1, 3, 0.5),
					}
					order_items.push(po);
				});

				var total = Math.round(_.reduce(order_items, function(t, po) {
					return t + po.quantity * po.unit_price;
				}, 0) * 100) / 100;

				var order = {
					order_date: date.toISOString().substr(0,10),
					customer_id: c.id,
					total_amount: total,
				}
				
				order.sandwiches = order_items;

				orders.push(order);
			});
			console.log("Orders added " + nOrders + " total " + orders.length);
			return orders;
		}

		function saveOrders(orders, done) {
			console.log("saving orders " + orders.length);

			db.insert('orders', orders, function(err, result) {
				var rows = result.rows;
				if (err) {
					console.log(err);
					done();
				} else {
					console.log('inserted orders... ' + rows.length);
				}
				var order_items = [];
				
				for(var i = 0;i < orders.length; ++i) {
					_.each(orders[i].sandwiches, function(po) {
						po.order_id = rows[i].id;
					});
					order_items =
						order_items.concat(orders[i].sandwiches);
				}

				db.insert('order_items', order_items, 
					function(err, result) {
					var rows = result.rows;
					if (err) {
						console.log(err);
					} else {
						console.log('inserted order_items... ' 
									+ rows.length);
					}
					done();
				});

				//console.log(order);
				//console.log(items);

			});
			
		}			

	});

});


