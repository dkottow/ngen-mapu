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

var mssql = require('mssql');

var Account = require('../Account.js').Account;
var Schema = require('../Schema.js').Schema;
var Database = require('./DatabaseMssql.js').DatabaseMssql;
var SqlHelper = require('./SqlHelperMssql.js').SqlHelperMssql;

var log = require('../log.js').log;

function AccountMssql(config) {
	this.config = config;

    log.debug({config: this.config}, "AccountMssql()...");
	Account.call(this, config.account);
}

AccountMssql.prototype = Object.create(Account.prototype);	

AccountMssql.prototype.init = function(cbAfter) {
	var me = this;
    try {
        var config = _.omit(this.config, 'account');
        config.database = 'master';

        log.trace({name: me.name}, "Account.init()...");
        var conn = new mssql.ConnectionPool(config);
        conn.connect().then(err => {

            //read all databases 
            var sql = util.format("SELECT [name] FROM sys.databases WHERE [name] LIKE '%s';"
                            , SqlHelper.Schema.fullName(this.name, '%'));

            log.debug({sql: sql}, 'Account.init()');

            conn.request().query(sql).then(result => {
                console.dir(result.recordset);



                //me.setSchema(schemaProps);
                conn.close();
                cbAfter();

            }).catch(err => {
                log.error({err: err}, "Account.init() sql exception.");
                conn.close();
                cbAfter(err);
            });

        }).catch(err => {
            log.error({err: err}, "Account.init() connection exception.");
            cbAfter(err);
        });	

	} catch(err) {
		log.error({err: err}, "Account.init() exception.");
		cbAfter(err);
	}

/*
	//serve each database
	fs.readdir(me.baseDir, function(err, files) {
		log.trace('Scanning ' + me.baseDir);

		if (err) {
			log.error({err: err}, "Account.init failed.");
			if (cbAfter) cbAfter(err);
			return;
		}


		var dbFiles = files.filter(function (file) {
			return (path.extname(file) == global.sqlite_ext);
		});

		log.trace({dbFiles: dbFiles});

		var doAfter = _.after(dbFiles.length, function() {
			log.trace("...Account.init()");
			if (cbAfter) cbAfter();
			return;
		});

		dbFiles.forEach(function (file, i, files) {
			log.trace({dbFile: file}, "init");

			var name = path.basename(file, global.sqlite_ext);
			var dbFile = path.join(me.baseDir, file);					

			me.databases[name] = new Database(dbFile);
			me.databases[name].readSchema(function(err) {
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
*/

}

AccountMssql.prototype.doRemoveDatabase = function(name, cbResult) {
	Database.remove(this.config, name, cbResult);
}

AccountMssql.prototype.doCreateDatabase = function(name) {
    var config = _.clone(this.config);
    config.database = SqlHelper.fullName(this.name, name); 
	return new Database(config);			
}


exports.AccountMssql = AccountMssql;

