/*
   Copyright 2016 Daniel Kottow

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at
 
       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
*/


var url = require('url');
var path = require('path');

require('dotenv').config(process.env.DL_DOTENV_PATH); 
var config = require('config');

var log = require('./app/log.js').log;

log.warn({config: config}, '***** reset *****');

var app = require('./app/app.js').app;

app.init({ auth: config.auth }, function(err) {

	if (err) throw err;

	app.listen(config.port, config.ip, function() {
		log.info({ip: config.ip, port: config.port}, "app listen() - listening.");
		//console.log("Started server on " + config.ip + ":" + config.port);
	});
});


/*


var url = require('url');
var path = require('path');

var envPath = './.env'; 
if (process.env.OPENSHIFT_DATA_DIR) { 
    envPath = process.env.OPENSHIFT_DATA_DIR + '/.env'; 
} 
 
require('dotenv').config({path: envPath}); 

var config = {
	'ip'      : 'localhost',
	'port'    : 3000, 
	
	'auth'	  : false, //TODO change me back
	
	'log_dir'  : 'logs',
	'log_level' : 'debug',

	'rows_page': 1000,

	'sql_engine': 'mssql',

	'mssql_connection': { 
		'server': 'azwu-test.database.windows.net',
		'user': 'Xidvv3jyCxQcSjbQYpf9zbiYv5MqE8Vp',
		'password': 'tI27k7i06mEUVh4TAxoavL$ErZwH@c49',
		'domain': undefined, //AD user domain
		options: {
			encrypt: true // Use this if you're on Windows Azure
		}
	}
	
}

if (config.sql_engine != 'mssql') {
	delete config.mssql_connection;
}

if (process.env.PORT) { //azure uses this
	config.port = process.env.PORT;
}

if (process.env.DONKEYLIFT_AUTH) {
	config.auth = parseInt(process.env.DONKEYLIFT_AUTH) != 0;
}

if (process.env.DONKEYLIFT_LOGLEVEL) {
	config.loglevel = process.env.DONKEYLIFT_LOGLEVEL;
}

if (process.env.OPENSHIFT_DATA_DIR) {
	config.ip = process.env.OPENSHIFT_NODEJS_IP;
	config.port = process.env.OPENSHIFT_NODEJS_PORT;
	config.logdir = process.env.OPENSHIFT_LOG_DIR;

} else if (process.env.C9_USER) {
	config.ip = process.env.IP;
	config.port = process.env.PORT;
}

if (process.env.DONKEYLIFT_MSSQL_CONNECTIONSTRING) {
	var conn_string = process.env.DONKEYLIFT_MSSQL_CONNECTIONSTRING;
	var resolve = require('mssql/lib/connectionstring.js').resolve;
	config.mssql_connection = resolve(conn_string);
}

//tmp dir (sqlite)
config.tmp_dir = path.join(process.cwd(), 'tmp');
if (process.env.OPENSHIFT_DATA_DIR) {
	config.tmp_dir = path.join(process.env.OPENSHIFT_DATA_DIR, 'tmp');
}

//data dir (sqlite)
if (config.sql_engine == 'sqlite') {
	config.sqlite_data_dir = path.join(process.cwd(), 'data');	
	if (process.env.OPENSHIFT_DATA_DIR) {
		config.sqlite_data_dir = path.join(process.env.OPENSHIFT_DATA_DIR, 'data');
	}
}

global.config = config;

var log = require('./app/log.js').log;

log.info("*********** DONKEYLIFT RESET DONKEYLIFT ***********.");
log.info({config: config});

var app = require('./app/app.js').app;

var options = {
	auth: config.auth
};
app.init(options, function(err) {

	if (err) throw err;

	app.listen(config.port, config.ip, function() {
		log.info({config: config}, "app listen() - listening.");
		//console.log("Started server on " + config.ip + ":" + config.port);
	});

});

*/
