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

function init() {

	if ( ! global.init_log) {

		_.each(config.logs.transports, function(logger) {
			//set some dynamic attrs
			if (logger.console) {
				logger.console.prettyPrint = prettyPrint;
			}
			if (logger.file && ! path.isAbsolute(logger.file.filename)) {
				logger.file.filename = path.join(process.cwd(), logger.file.filename);
			}
			if (logger.azure) {
				log.debug({logger: logger}, 'azure log.init()');	
                logger.azure.partition = require('os').hostname();				
			}
			winston.loggers.add('dl', logger);
		});

		winston.loggers.get('dl').rewriters.push(rewriteRequest);
		winston.loggers.get('dl').rewriters.push(rewriteError);
		winston.loggers.get('dl').rewriters.push(rewriteConfig);

		global.init_log = true;
	}
}

var log = {

	log: function(level, arg1, arg2) {
		if (arg2) {
			winston.loggers.get('dl').log(level, arg2, arg1);
		} else {
			winston.loggers.get('dl').log(level, arg1);
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
	if (obj && obj.err) {
		obj.err = {
			name: obj.err.name
			, message: obj.err.message
			, status: obj.err.status
			, stack: obj.err.stack
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
				name: obj.req.user.name
				, account: obj.req.user.account
				, role: obj.req.user.role
				, admin: obj.req.user.admin
			}
		} 
		obj.req = {
			url: obj.req.url
			, method: obj.req.method
			, user: user
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
	winston: winston
};


