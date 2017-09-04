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
	this.config = _.clone(config);
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
                log.debug({databases: result.recordset}, 'Account.init()');

                var doReturn = function() {
					log.debug("...Account.init()");
	                conn.close();
					if (cbAfter) cbAfter();
					return;
				};
                
                if (result.recordset.length == 0) doReturn();
				var doAfter = _.after(result.recordset.length, doReturn);

				result.recordset.forEach(function (row, i, rows) {
    				var dbConfig = _.clone(config);
					dbConfig.database = row.name;
					var db = new Database(dbConfig);
					me.databases[db.name()] = db;
                    doAfter();    
/*
                    db.readSchema(function(err) {
						log.debug({ db: db.name() }, "Account.init()");
						me.databases[db.name()] = db;
						if (err) {
			                conn.close();
							cbAfter(err);
							return;
						} 
						doAfter();
                    });
*/                    
				});

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
}

AccountMssql.prototype.doRemoveDatabase = function(name, cbResult) {
	Database.remove(this.config, name, cbResult);
}

AccountMssql.prototype.doCreateDatabase = function(name) {
    var config = _.clone(this.config);
    config.database = SqlHelper.Schema.fullName(this.name, name); 
	return new Database(config);			
}


exports.AccountMssql = AccountMssql;

