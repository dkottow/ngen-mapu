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

var _ = require('underscore');
var util = require('util');

var log = require('./log.js').log;

function Account(name) {
	if ( ! name) return;
	
	this.name = name;
	this.databases = {};

	log.debug("new Account " + this.name);
}

/* interfaces

Account.prototype.init = function(cbAfter) {
}

Account.prototype.createDatabase = function(schemaData, options, cbResult) {
}

Account.prototype.delDatabase = function(name, options, cbResult) {
}

*/

Account.prototype.database = function(name) { 
	return this.databases[name];
}

Account.prototype.getInfo = function(cbResult) {
	var me = this;

	var result = {
		name: me.name,
		databases: {}
	};

	var doAfter = _.after(_.size(me.databases), function() {
		cbResult(null, result);
	});

	_.each(this.databases, function(db) {
		db.getInfo({skipCounts: true}, function(err, schemaData) {
			if (err) {
				cbResult(err, null);
				return;
			}
			
			_.each(schemaData.tables, function(t) { 
				delete t.fields; 
			});
			result.databases[schemaData.name] = schemaData;
			doAfter();
		});
	});

	//handle empty account
	if (_.size(me.databases) == 0) {
		cbResult(null, result);
	};
}

exports.Account = Account;

