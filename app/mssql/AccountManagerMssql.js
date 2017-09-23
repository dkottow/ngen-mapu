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
var SqlHelper = require('./SqlHelperMssql.js').SqlHelperMssql;

var log = require('../log.js').log;

function AccountManagerMssql(config) {
    log.debug({config: config}, 'AccountManagerMssql()...');
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

        if (config.accounts) {
            log.debug({accounts: config.accounts, source: "config"}, "AccountManager.init()");
            me._init(config.accounts, cbAfter);
            
        } else {
            this.readAccounts(function(err, accounts) {
                if (err) {
                    log.error({err: err}, "AccountManager.init()");
                    return;
                }
                log.debug({accounts: accounts, source: "server"}, "AccountManager.init()");
                me._init(accounts, cbAfter);
            });    
        }

	} catch(err) {
		log.error({err: err}, "AccountManager.init() exception.");
		cbAfter(err);
	}
}

AccountManagerMssql.prototype._init = function(accounts, cbAfter) {
    var me = this;
    var doReturn = function() {
        log.trace("...AccountManager.init()");
        if (cbAfter) cbAfter();
        return;
    };
    
    if (accounts.length == 0) doReturn();
    var doAfter = _.after(accounts.length, doReturn);

    var config = _.clone(me.config);
    _.each(accounts, function(name) {
        config.account = name;    
        var account = new Account(config);
        account.init(function(err) {
            if (err) {
                cbAfter(err);
                return;
            } 
            me.accounts[account.name] = account;
            doAfter();
        });
    });            
}

AccountManagerMssql.prototype.readAccounts = function(cbResult) {
    try {
        var config = _.clone(this.config);
        config.database = 'master';

        log.trace({name: this.name}, "AccountManager.readAccounts()...");
        var conn = new mssql.ConnectionPool(config);
        conn.connect().then(err => {

            //read all accounts 
            var sql = util.format("SELECT DISTINCT SUBSTRING([name], 0, CHARINDEX('%s', [name])) AS account" 
                                + " FROM sys.databases WHERE CHARINDEX('%s', [name]) > 0;"
                                , SqlHelper.ACCOUNT_DATABASE_SEPARATOR, SqlHelper.ACCOUNT_DATABASE_SEPARATOR);

            log.debug({sql: sql}, 'AccountManager.readAccounts()');

            conn.request().query(sql).then(result => {
                log.trace(JSON.stringify(result.recordset));

                var accounts = _.map(result.recordset, function(row) {
                    return row.account;
                });
                accounts = _.without(accounts, 'tmp');
                conn.close();
                cbResult(null, accounts);

            }).catch(err => {
                log.error({err: err}, "AccountManager.readAccounts() sql exception.");
                conn.close();
                cbResult(err);
            });

        }).catch(err => {
            log.error({err: err}, "AccountManager.readAccounts() connection exception.");
            cbResult(err);
        });	

	} catch(err) {
		log.error({err: err}, "AccountManager.readAccounts() exception.");
		cbResult(err);
	}
}

AccountManagerMssql.prototype.create = function(name, cbAfter) {
    var me = this;
    try {
        if (this.accounts[name]) {
            var err = new Error(util.format("Account %s exists.", name));
            log.warn({err: err}, "AccountManager.create()");
            cbAfter(err, null);
            return;
        }

        var config = _.clone(this.config);
        config.account = name;    

        var account = new Account(config);
        account.init(function(err) {
            if (err) {
                cbAfter(err, null);
                return;
            } 
            me.accounts[account.name] = account;
            cbAfter(null, account);
        });
    
	} catch(err) {
		log.error({err: err}, "AccountManager.create() exception.");
		cbAfter(err, null);
	}
}

exports.AccountManagerMssql = AccountManagerMssql;

