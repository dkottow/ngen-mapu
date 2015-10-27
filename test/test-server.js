
var assert = require('assert')
	, _ = require('underscore')
	, util = require('util')
	, request = require('request')
	, app = require('../app/app').app;
	
describe('Server', function() {
	
	describe('get', function() {

		var server;

		before(function(done) {
			server = app.listen(3000, 'localhost', function() {
				done(); 
			});
		});	

		after(function() { 
			server.close(); 
		});

		it('GET /', function(done) {
			request('http://localhost:3000', function(error, rsp, body) {
				console.log(body);
				done();
			});

		});
	});

});

