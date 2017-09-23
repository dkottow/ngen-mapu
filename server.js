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

require('dotenv').config(); 
var config = require('config');

var log = require('./app/log.js').log;
var funcs = require('./app/funcs.js');

log.warn({env: process.env.NODE_ENV, config: config}, '***** reset *****');
log.info({ mem: funcs.memInfo() }, 'memory reset');

var app = require('./app/app.js').app;

app.init({ auth: config.auth }, function(err) {

	if (err) throw err;

	app.listen(config.port, config.ip, function() {
		log.info({ip: config.ip, port: config.port}, "app listen() - listening.");
        log.info({ mem: funcs.memInfo() }, 'memory listening');
		//console.log("Started server on " + config.ip + ":" + config.port);
	});
});


