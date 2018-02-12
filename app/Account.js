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

var Database = require('./Database.js').Database;

var log = require('./log.js').log;

function Account(name) {
	if ( ! name) return;
	
	this.name = name;
	this.databases = {};

	log.debug("new Account " + this.name);
}

Account.MASTER = '_d365';

/* interfaces

Account.prototype.init = function(cbAfter) {
}

Account.prototype.doCreateDatabase = function(name, cbResult) {
}

Account.prototype.doRemoveDatabase = function(name, cbResult) {
}

*/

Account.prototype.doWriteDatabase = function(schemaData, cbResult) {
	var me = this;
	var name = schemaData.name;
	var newDb = this.doCreateDatabase(name);

	newDb.setSchema(schemaData);
	newDb.write(function(err) {
		if (err) {
			cbResult(err, null);
			return;
		} 
		log.info("Created database " + name);
		me.databases[name] = newDb;
		cbResult(null, newDb);
	});
}

Account.prototype.createDatabase = function(schemaData, options, cbResult) {
	var me = this;
	var name = schemaData.name;

	cbResult = cbResult || arguments[arguments.length - 1];	
	options = typeof options == 'object' ? options : {};		

	var db = me.databases[name];
	if (db) {
			
		db.isEmpty(function(err, isEmpty) {

			if (isEmpty) {
				me.doWriteDatabase(schemaData, cbResult);

			} else {
				var err = new Error(util.format(
					"Database '%s' exists and is not empty.", name
				));
				log.warn({message: err.message}, "Account.createDatabase()");
				cbResult(err, null);
			}	
		});

	} else {
		me.doWriteDatabase(schemaData, cbResult);
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
						"Database '%s' is not empty.", name
					));
					log.warn({message: err.message}, "Account.delDatabase()");
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
		log.warn({message: err.message}, "Account.delDatabase()");
		cbResult(err, false);
	}
}

Account.prototype.database = function(name) { 
	return this.databases[name];
}

Account.prototype.master = function(name) { 
	return this.databases[Database.MASTER];
}

Account.prototype.getInfo = function(cbResult) {
	var databases = _.map(this.databases, function(db) { 
		return { 
			name: db.name(), 
			init: db.initInfo() 
		};
	});
	databases = _.object(_.pluck(databases, 'name'), databases);
	
	var result = {
		name: this.name,
		databases: databases
	};

	cbResult(null, result);
}

exports.Account = Account;

