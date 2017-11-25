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

var path = require('path');
var _ = require('underscore');
var config = require('config');
var winston = require('winston');
require('winston-azure'); //add winston-azure

var winstonLogger;
function init() {

	if ( ! global.init_log) {

		winstonLogger = new (winston.Logger)({ transports: [] });
		var transport;

		_.each(config.logs.transports, function(options) {
			//set some dynamic attrs
			if (options.type == 'console') {
				options.prettyPrint = prettyPrint;
				transport = new winston.transports.Console(options);				

			} else if (options.type == 'file' && ! path.isAbsolute(options.filename)) {
				options.filename = path.join(process.cwd(), options.filename);
				transport = new winston.transports.File(options);

			} else if (options.type == 'azure') {
				options.partition = require('os').hostname();
				transport = new winston.transports.Azure(options);
				transport.name = options.name; //otherwise not picked up by winston-azure
			}
			if (transport) {
				winstonLogger.add(transport, {}, true);			
			} else {
				throw new Error('Unknown winston transport type.');
			}
		});

		winstonLogger.rewriters.push(rewriteRequest);
		winstonLogger.rewriters.push(rewriteError);
		winstonLogger.rewriters.push(rewriteConfig);

		global.init_log = true;
	}
}

var log = {

	log: function(level, arg1, arg2) {
		if (arg2) {
			winstonLogger.log(level, arg2, arg1);
		} else {
			winstonLogger.log(level, arg1);
		}
	},

	error: function(obj, msg) {
		this.log('error', obj, msg);		
	},

	warn: function(obj, msg) {
		this.log('warn', obj, msg);		
	},

	info: function(obj, msg) {
		this.log('info', obj, msg);
	},

	debug: function(obj, msg) {
		this.log('debug', obj, msg);
	},

	trace: function(obj, msg) {
		this.log('silly', obj, msg);
	},
}

var rewriteError = function(level, msg, obj) {
	//if (level == 'error') return obj; //doesnt work

	if (obj && obj.err) {
		obj.err = {
			message: obj.err.message
			, stack: (obj.err.stack || '').substr(0,400)
			, name: obj.err.name
			, status: obj.err.status
		}
	}
	return obj;
}

var rewriteConfig = function(level, msg, obj) {
	if (obj && obj.config) {
		if (obj.config.password) {
			var config = _.omit(obj.config, 'password');
		}

		if (obj.config.sql && obj.config.sql.connection) {
			var config = _.omit(obj.config, 'sql');
			config.sql = _.clone(obj.config.sql);
			config.sql.connection = _.omit(obj.config.sql.connection, 'password');
		}

		return _.extend(obj, { config: config });
	}
	return obj;
}

var rewriteRequest = function(level, msg, obj) {
	if (obj && obj.req) {
		var user;
		if (obj.req.user) {
			user = {
				name: obj.req.user.name()
			}
		} 
		obj.req = {
			url: obj.req.url
			, method: obj.req.method
			, user: user
			, headers: obj.req.headers
			, params: obj.req.params
			, query: obj.req.query
		};
	}
	return obj;
}

var prettyPrint = function(obj) {
	var json = JSON.stringify(obj, null, 2);
	return json.replace(/\"([^(\")"]+)\":/g,"$1:");
}

init();

module.exports = { 
	log: log,
	logger: winstonLogger
};


