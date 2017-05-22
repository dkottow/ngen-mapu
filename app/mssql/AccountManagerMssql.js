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
var mssql = require('mssql');

var Account = require('./AccountMssql.js').AccountMssql;
var AccountManager = require('../AccountManager.js').AccountManager;

var log = require('../log.js').log;

function AccountManagerMssql(config) {
	this.config = _.clone(config);
	AccountManager.call(this);
}

AccountManagerMssql.prototype = Object.create(AccountManager.prototype);	


AccountManagerMssql.prototype.init = function(cbAfter) {
	var me = this;
    try {
        var config = _.clone(this.config);
        config.database = 'master';

        log.trace({name: me.name}, "AccountManager.init()...");
        var conn = new mssql.ConnectionPool(config);
        conn.connect().then(err => {

            //read all databases 
            var sql = util.format("SELECT DISTINCT SUBSTRING([name], 0, CHARINDEX('%s', [name])) AS account" 
                                + " FROM sys.databases WHERE CHARINDEX('%s', [name]) > 0;"
                                , '#', '#');

            log.debug({sql: sql}, 'AccountManager.init()');

            conn.request().query(sql).then(result => {
                log.trace(JSON.stringify(result.recordset));

				var doAfter = _.after(result.recordset.length, function() {
					log.trace("...Account.init()");
	                conn.close();
					if (cbAfter) cbAfter();
					return;
				});

                var config = _.clone(me.config);
				result.recordset.forEach(function (row, i, rows) {
                    config.account = row.account;    
					var account = new Account(config);
					account.init(function(err) {
						if (err) {
			                conn.close();
							cbAfter(err);
							return;
						} 
						me.accounts[account.name] = account;
						doAfter();
					});
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

AccountManagerMssql.prototype.create = function(name, cbAfter) {
    throw new Error();
}

exports.AccountManagerMssql = AccountManagerMssql;

