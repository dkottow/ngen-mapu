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

var Account = require('../Account.js').Account;
var Schema = require('../Schema.js').Schema;
var Database = require('./DatabaseSqlite.js').DatabaseSqlite;
var SqlHelper = require('./SqlHelperSqlite.js').SqlHelperSqlite;

var log = require('../log.js').log;

function AccountSqlite(dir) {
	this.baseDir = dir;
	var name = path.basename(dir);
	Account.call(this, name);
}

AccountSqlite.prototype = Object.create(Account.prototype);	

AccountSqlite.prototype.init = function(cbAfter) {
	var me = this;

	log.trace({baseDir: me.baseDir}, "Account.init()...");
	//serve each database
	fs.readdir(me.baseDir, function(err, files) {
		log.trace('Scanning ' + me.baseDir);

		if (err) {
			log.error({err: err}, "Account.init failed.");
			if (cbAfter) cbAfter(err);
			return;
		}


		var dbFiles = files.filter(function (file) {
			return (path.extname(file) == SqlHelper.FileExtension);
		});

		log.trace({dbFiles: dbFiles});

		var doAfter = _.after(dbFiles.length, function() {
			log.trace("...Account.init()");
			if (cbAfter) cbAfter();
			return;
		});

		dbFiles.forEach(function (file, i, files) {
			log.trace({dbFile: file}, "init");

			var dbFile = path.join(me.baseDir, file);					
			var db = new Database(dbFile);

			db.readSchema(function(err) {
				me.databases[db.name()] = db;
				if (err) {
					cbAfter(err);
					return;
				} 
				doAfter();
			});
		});

		//handle empty dir
		if (dbFiles.length == 0) {
			log.debug("Account " + me.name + " is empty.");
			if (cbAfter) cbAfter();
		}
	});
}

AccountSqlite.prototype.doRemoveDatabase = function(name, cbResult) {
	var dbFile = this.databases[name].dbFile;
	Database.remove(dbFile, cbResult);
}

AccountSqlite.prototype.doCreateDatabase = function(name) {
	var dbFile = util.format('%s/%s%s',
						this.baseDir, name, SqlHelper.FileExtension);
	return new Database(dbFile);			
}


exports.AccountSqlite = AccountSqlite;

