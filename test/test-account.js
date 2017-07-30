
var assert = require('assert')
	, _ = require('underscore')
	, util = require('util')
	, path = require('path')
	, fse = require('fs-extra');

require('dotenv').config(process.env.DL_DOTENV_PATH); 
var config = require('config');

var AccountFactory = require('../app/AccountFactory').AccountFactory
	, Schema = require('../app/Schema').Schema;

var log =  require('./log').log;

describe('Account', function() {

	var accountName = 'sqlite';
	var accountConfig;

	if (config.sql.engine == 'sqlite') {
		accountConfig = path.join('./test/data', accountName);

	} else if (config.sql.engine == 'mssql') {
		accountConfig = {
			account: 'test'
		};
			
	}

	describe('Account.init()', function() {
		it('account init', function(done) {
			
			this.timeout(10000); //10secs
			var account = AccountFactory.create(accountConfig);
			account.init(function(err) {
				assert(account.database('temp-sales').table('customers'));
				done();
			});
		});

		it('account does not exist', function(done) {
			var account = AccountFactory.create('foo');
			account.init(function(err) {
				assert(err instanceof Error);
				done();
			});

		});
	});
	
	describe('Account.getInfo()', function() {
		
		var account = AccountFactory.create(accountConfig);

		before(function(done) {
			this.timeout(10000); //10secs
			account.init(function(err) { done(); });
		});	

		it('getInfo', function(done) {
			account.getInfo(function(err, accountData) {
				assert(_.size(accountData.databases) > 0);
				assert(accountData.databases.sales
					, 'sales db not found');
				done();
			});
		});
	});

	describe('Account.createDatabase()', function() {

		var jsonSalesFile = "test/data/json/sales.json";
		
		var account = AccountFactory.create(accountConfig);
		var schema = new Schema();

		before(function(done) {
			var allDone = _.after(2, function() { done(); });
			account.init(function(err) { 
				allDone(); 
			});
			schema.jsonRead(jsonSalesFile, function(err) {
				allDone(); 
			});
		});	

		after(function(done) {
			var newSalesFile = accountConfig + '/new_sales.sqlite';
			fse.unlink(newSalesFile, function(err) {
				done();
			});
		});

		it('write sales to new_sales', function(done) {
			var schemaData = schema.get();
			schemaData.name = "new_sales";
			account.createDatabase(schemaData, function(err, db) {
				assert(db.schema.get().name == "new_sales");
				done();
			});
		});

		it('try to overwrite sales', function(done) {
			var schemaData = schema.get();
			account.createDatabase(schemaData, function(err, db) {
				assert(err instanceof Error && db == null);
				db = account.database(schemaData.name);
				assert(db.schema.get().name == "sales");
				done();
			});
		});
	});


	describe('Account.delDatabase()', function() {

		var accountDir = accountConfig;
		var salesDbFile = accountDir + "/sales.sqlite";
		var emptySalesFile = accountDir + "/sales_empty.sqlite";
		var emptyCopySalesFile = accountDir + "/sales_empty_copy.sqlite";
		var copySalesFile = accountDir + "/sales_copy.sqlite";
		
		var account = AccountFactory.create(accountConfig);
		var schema = new Schema();

		before(function(done) {
			var allDone = _.after(2, function() { 
				account.init(function(err) { 
					done(); 
				});
			});

			var fn = accountDir + '/sales_empty_copy.sqlite';
			fse.copy(emptySalesFile, fn, function(err) {
				allDone();
			});

			var fn = accountDir + '/sales_copy.sqlite';
			fse.copy(salesDbFile, fn, function(err) {
				allDone();
			});
		});	

		it('delete new_sales', function(done) {
			account.delDatabase('sales_empty_copy', function(err, success) {
				assert(success);
				done();
			});
		});

		it('try to delete sales', function(done) {
			account.delDatabase('sales_copy', function(err, success) {
				//console.log(err);
				assert(err instanceof Error && success == false);
				done();
			});
		});

		it('force delete sales', function(done) {
			account.delDatabase('sales_copy', {force: true}, function(err, success) {
				assert(success);
				done();
			});
		});


	});

});


