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

var fs = require('fs');
var path = require('path');
var util = require('util');

var Schema = require('./Schema.js').Schema;
var Database = require('./Database.js').Database;

var log = require('./log.js').log;

global.sqlite_ext = global.sqlite_ext || '.sqlite';

function Account(baseDir) {
	this.baseDir = baseDir;
	this.name = path.basename(baseDir);
	this.databases = {};

	log.debug("new Account " + this.name);
}

Account.prototype.init = function(cbAfter) {
	var me = this;

	log.trace({baseDir: me.baseDir}, "Account.init()...");
	//serve each database
	fs.readdir(me.baseDir, function(err, files) {
		log.trace('Scanning ' + me.baseDir);

		if (err) {
			log.error({err: err}, "Account.init failed.");
			cbAfter(err);
			return;
		}


		var dbFiles = files.filter(function (file) {
			return (path.extname(file) == global.sqlite_ext);
		});

		log.trace({dbFiles: dbFiles});

		var doAfter = _.after(dbFiles.length, function() {
			log.trace("...Account.init()");
			cbAfter();
			return;
		});

		dbFiles.forEach(function (file, i, files) {
			log.trace({dbFile: file}, "init");

			var name = path.basename(file, global.sqlite_ext);
			var dbFile = path.join(me.baseDir, file);					

			me.databases[name] = new Database(dbFile);

			me.databases[name].init(function() { 
				doAfter();
			});
		});

		//handle empty dir
		if (dbFiles.length == 0) {
			log.debug("Account " + me.name + " is empty.");
			cbAfter();
		}
	});
}

Account.prototype.database = function(name) { 
	return this.databases[name];
}

Account.prototype.getInfo = function(cbResult) {
	var me = this;

	var result = {
		name: me.name,
		databases: []
	};

	var doAfter = _.after(_.size(me.databases), function() {
		cbResult(null, result);
	});

	_.each(this.databases, function(db) {
		db.getInfo({skipCounts: true}, function(err, schemaData) {
			_.each(schemaData.tables, function(t) { 
				delete t.fields; 
			});
			result.databases.push(schemaData);
			doAfter();
		});
	});

	//handle empty account
	if (_.size(me.databases) == 0) {
		cbResult(null, result);
	};
}

Account.prototype.createDatabase = function(schemaData, options, cbResult) {
	var me = this;
	var name = schemaData.name;

	var dbFile = util.format('%s/%s', me.baseDir, 
				name + global.sqlite_ext);

	cbResult = cbResult || arguments[arguments.length - 1];	
	options = typeof options == 'object' ? options : {};		

	var createSchemaFn = function() {

		var newSchema = new Schema();
		newSchema.init(schemaData);

		newSchema.write(dbFile, function(err) {
			if (err) {
				cbResult(err, null);
				return;
			} 
			log.info("Created database file " + dbFile);
			var newDb = new Database(dbFile, {schema: newSchema});	
			me.databases[name] = newDb;
			cbResult(null, newDb);
		});
	}

	var db = me.databases[name];
	if (db) {
			
		db.isEmpty(function(err, isEmpty) {

			if (isEmpty) {
				createSchemaFn();

			} else {
				var err = new Error(util.format(
					"Database %s exists and is not empty.", name
				));
				log.warn({err: err}, "Account.createDatabase()");
				cbResult(err, null);
			}	
		});

	} else {
		createSchemaFn();
	}
}

Account.prototype.delDatabase = function(name, options, cbResult) {
	var me = this;

	cbResult = cbResult || arguments[arguments.length - 1];	
	options = typeof options == 'object' ? options : {};		

	var checkEmpty = ! options.force; 
	if (name == "demo") checkEmpty = true; //do not delete demo data

	var removeDatabaseFn = function() {
		var dbFile = me.databases[name].dbFile;
		Schema.remove(dbFile, function(err) {
			if (err) {
				cbResult(err, false);
				return;
			}
			log.info("Deleted database file " + dbFile);
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

exports.Account = Account;

