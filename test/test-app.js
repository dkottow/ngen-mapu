
var assert = require('assert')
	, _ = require('underscore')
	, util = require('util')
	, request = require('request')
	, path = require('path')
	, jwt = require('jsonwebtoken');
	
require('dotenv').config();

var log = require('./log.js').log;

var useAuth = false;
var authToken = null;

global.config = global.config || {};
global.config.sql_engine = 'sqlite';
global.config.sqlite_data_dir = path.join(process.cwd(), 'data');

var app = require('../app/app.js').app;

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
	if (useAuth) {
		options.auth = { bearer: authToken };
	}
	request.get(options,
		function(err, rsp, body) {
			log.debug(options);
			if (err || rsp.statusCode != 200) {
				err = err || new Error(rsp.statusCode + ' error. ' + options.url);
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
		var testDatabase = 'sandwiches';

		var options = { auth: useAuth };

		before(function(done) {
			this.timeout(10000);
			app.init(options, function(err) {
				server = app.listen(config.port, config.ip, function() {
					log.info({config: config}, "server started.");
					if (useAuth) {

						var loginUrl = baseUrl + '/public/login';
						var form = { form : {
							email: "demo@donkeylift.com"
							, password: "demo"
						}};

						request.post(loginUrl, form, function(err, rsp, body) {
							assert(err == null, "err " + err);
							//we need to parse json ourselves here, 
							//since we posted urlencoded :-(
							authToken = JSON.parse(body).id_token;
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
					return db.name == testDatabase;
				}), 'response has no ' + testDatabase + ' db');
				done();
			});

		});

		it('getDatabase', function(done) {		
			url = baseUrl + '/' + demoAccount + '/' + testDatabase;
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

