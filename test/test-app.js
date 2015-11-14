
var assert = require('assert')
	, _ = require('underscore')
	, util = require('util')
	, request = require('request')
	, app = require('../app/app').app;
	
var log = global.log;

var config = {
	'ip'	:  'localhost',
	'port'	: 3000, 
}

if (process.env.C9_USER) {
	config.ip = process.env.IP;
	config.port = process.env.PORT;
}

function get(url, cbAfter) {
	request(url, function(error, rsp, body) {
		assert(!error && rsp.statusCode == 200, 'response error');
		log.info(body);

		cbAfter(JSON.parse(body));
	});
}

describe('Server (app)', function() {

	describe('GET', function() {

		var server;
		var baseUrl = 'http://localhost:' + config.port;
		var demoAccount = 'demo';
		var salesDatabase = 'sales';

		before(function(done) {
			server = app.listen(config.port, config.ip, function() {
				done(); 
			});
		});	

		after(function() { 
			server.close(); 
		});


		it(baseUrl, function(done) {
			get(baseUrl, function(result) {
				assert(result.accounts, 'response malformed');
				assert(_.find(result.accounts, function(a) {
					return a.name == demoAccount;
				}), 'response has no demo account');
				done();
			});
		});

		it(baseUrl + '/' + demoAccount, function(done) {		
			get(baseUrl + '/' + demoAccount, function(result) {
				assert(result.databases, 'response malformed');
				assert(_.find(result.databases, function(db) {
					return db.name == salesDatabase;
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

