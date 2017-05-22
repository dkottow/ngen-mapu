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

var envPath = './.env'; 
if (process.env.OPENSHIFT_DATA_DIR) { 
    envPath = process.env.OPENSHIFT_DATA_DIR + '/.env'; 
} 
 
require('dotenv').config({path: envPath}); 

var config = {
	'ip'      : 'localhost',
	'port'    : 3000, 
	
	'auth'	  : true,
	
	'logdir'  : 'logs',
	'loglevel' : 'debug',

	'rowspage': 1000,
	'sqlengine': 'mssql'
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

