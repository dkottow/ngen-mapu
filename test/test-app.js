
var assert = require('assert')
	, _ = require('underscore')
	, util = require('util')
	, request = require('request')
	, jwt = require('jsonwebtoken');
	
require('dotenv').config();

global.log = require('./create_log.js').log;

global.auth = false;
var authOptions = {
	url: 'https://dkottow.auth0.com/oauth/ro',
	json: true,
	body: {
		client_id: process.env.AUTH0_CLIENT_ID // Donkeylift 
/*
		, username: 'dkottow@gmail.com'
		, password: 'W3Seguro'
*/
		, username: 'john@doe.com'
		, password: 'johndoe'
		, connection: 'DonkeyliftConnection'
		, scope: 'openid name app_metadata'
	} 
};
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
		function(error, rsp, body) {
			if (error) {
				log.error(error);			
				throw new Error(error);
			}
			if (rsp.statusCode != 200) {
				//console.log(rsp);
				log.error(rsp);
				throw new Error(body);
			}
			log.info(body);
			cbAfter(JSON.parse(body));
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
						request.post(authOptions, function(err, rsp, body) {
							authToken = body.id_token;
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


		it('listAccounts', function(done) {
			//this.timeout(10000);
			get(baseUrl, function(result) {
				assert(result.accounts, 'response malformed');
				assert(_.find(result.accounts, function(a) {
					return a.name == demoAccount;
				}), 'response has no demo account');
				done();
			});
		});

		it('getAccount', function(done) {		
			url = baseUrl + '/' + demoAccount;
			get(url, function(result) {
				assert(result.databases, 'response malformed');
				assert(_.find(result.databases, function(db) {
					return db.name == salesDatabase;
				}), 'response has no sales database');
				done();
			});

		});

		it('getDatabase', function(done) {		
			url = baseUrl + '/' + demoAccount + '/' + salesDatabase;
			get(url, function(result) {
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

