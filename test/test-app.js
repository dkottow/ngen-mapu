
var assert = require('assert')
	, _ = require('underscore')
	, util = require('util')
	, request = require('request')
	, app = require('../app/app').app;
	
describe('app', function() {
	
	describe('GET', function() {

		var server;
		var baseUrl = 'http://localhost:3000';
		var demoAccount = 'demo';
		var demoDatabase = 'sales';

		before(function(done) {
			server = app.listen(3000, 'localhost', function() {
				done(); 
			});
		});	

		after(function() { 
			server.close(); 
		});

		it('list accounts', function(done) {		
			request(baseUrl, function(error, rsp, body) {
				assert(!error && rsp.statusCode == 200, 'response error');
				console.log(body);

				var result = JSON.parse(body);
				assert(result.accounts.length > 0, 'response malformed');
				assert(_.find(result.accounts, function(a) {
					return a.name == demoAccount;
				}), 'response has no demo account');
				done();
			});

		});

		it('list databases', function(done) {		
			request(baseUrl + '/' + demoAccount, function(error, rsp, body) {
				assert(!error && rsp.statusCode == 200, 'response error');
				console.log(body);

				var result = JSON.parse(body);
				assert(result.databases, 'response malformed');
				assert(_.find(result.databases, function(db) {
					return db.name == demoDatabase;
				}), 'response has no sales database');
				done();
			});

		});
	});

	describe('PATCH', function() {

		var server;

		before(function(done) {
			server = app.listen(3000, 'localhost', function() {
				done(); 
			});
		});	

		after(function() { 
			server.close(); 
		});

	});

});

