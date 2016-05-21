
var assert = require('assert')
	, _ = require('underscore')
	, util = require('util');
	
global.log = require('./create_log.js').log;
	
var Account = require('../app/Account').Account
	, Schema = require('../app/Schema').Schema;
	
var log = global.log.child({'mod': 'mocha.test-account.js'});

describe('Account', function() {
	var accountDir = "test/data/account";

	describe('Account.init()', function() {
		it('account does not exist', function(done) {
			var account = new Account('foo/bar');
			account.init(function(err) {
				assert(err instanceof Error);
				done();
			});

		});
	});
	
	describe('Account.get()', function() {
		
		var account = new Account(accountDir);
		before(function(done) {
			account.init(function(err) { done(); });
		});	

		it('get', function(done) {
			account.get(function(err, accountData) {
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
			account.init(function(err) { 
				schema.jsonRead(jsonSalesFile, function(err) {
					done(); 
				});
			});
		});	

		it('writeSchema', function(done) {
			var schemaData = schema.get();
			schemaData.name = "new_sales";
			account.writeSchema(schemaData, function(err, db) {
				done();
			});
		});
	});
});


