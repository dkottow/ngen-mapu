
var assert = require('assert')
	, _ = require('underscore')
	, util = require('util')
	, request = require('request')
	, jwt = require('jsonwebtoken');
	
require('dotenv').config();

global.log = require('./create_log.js').log;

global.auth = false;
var authToken = null;

var app = require('../app/app.js').app;

var log = global.log.child({'mod': 'mocha.test-app.js'});

var config = {
	'ip'	:  'localhost',
	'port'	: 3000, 
}

if (process.env.C9_USER) {
	config.ip = process.env.IP;
	config.port = process.env.PORT;
}

function get(url, cbAfter) {
	var options = {
		url: url
	};
	if (global.auth) {
		options.auth = { bearer: authToken };
	}
	request.get(options,
		function(err, rsp, body) {
			if (err || rsp.statusCode != 200) {
				err = err 
					|| new Error(rsp.statusCode + ' error.' + rsp.body);
				log.error(err);			
				cbAfter(err, null);
				return;
			}
			log.debug(body);
			cbAfter(null, JSON.parse(body));
		}
	);
}

describe('Server (app)', function() {

	describe('GET', function() {

		var server;
		var baseUrl = 'http://' + config.ip + ':' + config.port;
		var url = baseUrl;
		var demoAccount = 'demo';
		var salesDatabase = 'sales';

		before(function(done) {
			this.timeout(10000);
			app.init(function(err) {
				server = app.listen(config.port, config.ip, function() {
					log.info({config: config}, "server started.");
					if (global.auth) {

						var loginUrl = baseUrl + '/public/login';
						var form = { form : {
							email: "dbreader@donkeylift.com"
							, password: "dbreader"
						}};

						request.post(loginUrl, form, function(err, rsp, body) {
							assert(err == null, "err " + err);
							//we need to parse json ourselves here, 
							//since we posted urlencoded :-(
							authToken = JSON.parse(body).token;
							assert(authToken, "no auth token. login failed");
							done();
						});
					} else {
						done(); 
					}
				});
			});
		});	

		after(function() { 
			server.close(); 
		});


/*
		it('listAccounts', function(done) {
			//this.timeout(10000);
			get(baseUrl, function(err, result) {
				assert(err == null, err ? err.message : "");
				assert(result.accounts, 'response malformed');
				assert(_.find(result.accounts, function(a) {
					return a.name == demoAccount;
				}), 'response has no demo account');
				done();
			});
		});
*/

		it('getAccount', function(done) {		
			url = baseUrl + '/' + demoAccount;
			get(url, function(err, result) {
				assert(err == null, err ? err.message : "");
				//console.log(result.databases);
				assert(result.databases, 'response malformed');
				assert(_.find(result.databases, function(db) {
					return db.name == salesDatabase;
				}), 'response has no sales database');
				done();
			});

		});

		it('getDatabase', function(done) {		
			url = baseUrl + '/' + demoAccount + '/' + salesDatabase;
			get(url, function(err, result) {
				assert(err == null, err ? err.message : "");
				assert(result.tables, 'response malformed');
				assert(_.find(result.tables, function(table) {
					return table.name == 'customers';
				}), 'response has no customers table');
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

