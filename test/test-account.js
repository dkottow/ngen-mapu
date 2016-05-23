
var assert = require('assert')
	, _ = require('underscore')
	, util = require('util')
	, fse = require('fs-extra');
	
global.log = require('./create_log.js').log;
	
var Account = require('../app/Account').Account
	, Schema = require('../app/Schema').Schema;
	
var log = global.log.child({'mod': 'mocha.test-account.js'});

describe('Account', function() {
	var accountDir = "test/data/account";

	describe('Account.init()', function() {
		it('account init', function(done) {
			var account = new Account(accountDir);
			account.init(function(err) {
				done();
			});
		});

		it('account does not exist', function(done) {
			var account = new Account('foo/bar');
			account.init(function(err) {
				assert(err instanceof Error);
				done();
			});

		});
	});
	
	describe('Account.getInfo()', function() {
		
		var account = new Account(accountDir);

		before(function(done) {
			account.init(function(err) { done(); });
		});	

		it('getInfo', function(done) {
			account.getInfo(function(err, accountData) {
				assert(_.size(accountData.databases) > 0);
				assert(_.size(accountData.databases['sales'].tables) > 0);
				done();
			});
		});
	});

	describe('Account.writeSchema()', function() {

		var jsonSalesFile = "test/data/json/sales.json";
		
		var account = new Account(accountDir);
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
			var newSalesFile = accountDir + '/new_sales.sqlite';
			fse.unlink(newSalesFile, function(err) {
				done();
			});
		});

		it('write sales to new_sales', function(done) {
			var schemaData = schema.get();
			schemaData.name = "new_sales";
			account.writeSchema(schemaData, function(err, db) {
				assert(db.schema.get().name == "new_sales");
				done();
			});
		});

		it('try to overwrite sales', function(done) {
			var schemaData = schema.get();
			account.writeSchema(schemaData, function(err, db) {
				assert(err instanceof Error && db == null);
				db = account.database(schemaData.name);
				assert(db.schema.get().name == "sales");
				done();
			});
		});
	});


	describe('Account.delDatabase()', function() {
		var salesDbFile = "test/data/account/sales.sqlite";
		var emptySalesFile = "test/data/account/sales_empty.sqlite";
		var emptyCopySalesFile = "test/data/account/sales_empty_copy.sqlite";
		var copySalesFile = "test/data/account/sales_copy.sqlite";
		
		var account = new Account(accountDir);
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


