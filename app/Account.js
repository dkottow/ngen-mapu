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

Account.prototype.doCreateDatabase = function(name, cbResult) {
}

Account.prototype.doRemoveDatabase = function(name, cbResult) {
}

*/

Account.prototype.createDatabase = function(schemaData, options, cbResult) {
	var me = this;
	var name = schemaData.name;

	cbResult = cbResult || arguments[arguments.length - 1];	
	options = typeof options == 'object' ? options : {};		

	var createDatabaseFn = function() {

		var newDb = me.doCreateDatabase(name);

		newDb.setSchema(schemaData);
		newDb.writeSchema(function(err) {
			if (err) {
				cbResult(err, null);
				return;
			} 
			log.info("Created database " + name);
			me.databases[name] = newDb;
			cbResult(null, newDb);
		});

	}

	var db = me.databases[name];
	if (db) {
			
		db.isEmpty(function(err, isEmpty) {

			if (isEmpty) {
				createDatabaseFn();

			} else {
				var err = new Error(util.format(
					"Database %s exists and is not empty.", name
				));
				log.warn({err: err}, "Account.createDatabase()");
				cbResult(err, null);
			}	
		});

	} else {
		createDatabaseFn();
	}
}

Account.prototype.delDatabase = function(name, options, cbResult) {
	var me = this;

	cbResult = cbResult || arguments[arguments.length - 1];	
	options = typeof options == 'object' ? options : {};		

	var checkEmpty = ! options.force; 
	if (name == "demo") checkEmpty = true; //do not delete demo data

	var removeDatabaseFn = function() {
		me.doRemoveDatabase(name, function(err) {
			if (err) {
				cbResult(err, false);
				return;
			}
			log.info("Removed database " + name);
			delete me.databases[name];
			cbResult(null, true);
		});
	}

	var db = me.databases[name];
	if (db) {
		if (checkEmpty) {	
			db.isEmpty(function(err, isEmpty) {

				if (isEmpty) {
					removeDatabaseFn();

				} else {
					var err = new Error(util.format(
						"Database %s is not empty.", name
					));
					log.warn({err: err}, "Account.delDatabase()");
					cbResult(err, false);
				}	
			});
		} else {
			removeDatabaseFn();
		}
	} else {
		var err = new Error(util.format(
			"Database %s not found.", name
		));
		log.warn({err: err}, "Account.delDatabase()");
		cbResult(err, false);
	}
}

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

