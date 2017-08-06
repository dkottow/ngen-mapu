/*
	mocha tests - run me from parent dir
*/
var assert = require('assert')
	, _ = require('underscore')
	, util = require('util');

require('dotenv').config(process.env.DL_DOTENV_PATH); 
var config = require('config');

var DatabaseFactory = require('../app/DatabaseFactory').DatabaseFactory;
var Database = DatabaseFactory.getClass();

var User = require('../app/User').User; 
var log = require('./log.js').log;

describe('User', function() {
    var dbMaster;
	this.timeout(5000); 
	before(function(done) {
        var dbConfig;
        if (config.sql.engine == 'sqlite') {
            dbConfig = "master.sqlite";
        } else if (config.sql.engine == 'mssql') {
            var dbConfig = _.clone(config.sql.connection);
            dbConfig.database = 'test$master';
        }
        dbMaster = DatabaseFactory.create(dbConfig);        
        done();
	});

    describe('User.access', function() {
        var db;

        before(function(done) {
            var dbConfig;
            if (config.sql.engine == 'sqlite') {
                dbConfig = "sandwiches.sqlite";
            } else if (config.sql.engine == 'mssql') {
                var dbConfig = _.clone(config.sql.connection);
                dbConfig.database = 'test$sandwiches';
            }
            db = DatabaseFactory.create(dbConfig);        
            done();
        });

        it('Sandwich Admin access', function(done) {
            var user = new User('SWAdmin@golder.com', dbMaster);
            user.access(db).then((access) => {
                log.debug({access: access}, 'Sandwich Admin access');    
                assert(access.Read == 'all' && access.Write == 'all');
                done();
            }).catch((err) => {
                log.error(err);
                assert(false);
                done();
            });
        });

        it('Sandwich Unknown access', function(done) {
            var user = new User('unk@golder.com', dbMaster);
            user.access(db).then((access) => {
                log.debug({access: access}, 'Sandwich Unknown access');    
                assert(access.Read == 'none' && access.Write == 'none');
                return user.access(db, {'table': '__d365Users'});
            }).then((access) => {
                log.debug({access: access}, 'Sandwich Unknown access');    
                assert(access.Read == 'none' && access.Write == 'none');
                done();
            }).catch((err) => {
                log.error(err);
                assert(false);
                done();
            });
        });

        it('Sandwich User access', function(done) {
            var user = new User('SWUser1@golder.com', dbMaster);
            user.access(db, {table: 'customers'}).then((access) => {
                log.debug({access: access}, 'Sandwich User access');    
                assert(access.Read == 'all' && access.Write == 'own');
                done();
            }).catch((err) => {
                log.error(err);
                assert(false);
                done();
            });
        });

        it('Sandwich User access to __d365Users', function(done) {
            var user = new User('SWUser1@golder.com', dbMaster);
            user.access(db, {table: '__d365Users'}).then((access) => {
                log.debug({access: access}, 'Sandwich User access');    
                assert(access.Read == 'all' && access.Write == 'none');
                done();
            }).catch((err) => {
                log.error(err);
                assert(false);
                done();
            });
        });
    });

    describe('User.isAdmin', function() {
        it('dkottow is system admin', function(done) {
            var user = new User('dkottow@golder.com', dbMaster);
            user.isAdmin().then((isAdmin) => {
console.log('*********** ' + isAdmin + ' **************');
                assert(isAdmin == true);
                done();
            }).catch((err) => {
                log.error(err);
                assert(false);
                done();
            });
        });

        it('nobody is not system admin', function(done) {
            var user = new User('nobody@golder.com', dbMaster);
            user.isAdmin().then((isAdmin) => {
                assert(isAdmin == false);
                done();
            }).catch((err) => {
                log.error(err);
                assert(false);
                done();
            });
        });

        it('rfurman is IoT account admin', function(done) {
            var user = new User('rfurman@golder.com', dbMaster);
            user.isAdmin({account: 'IoT'}).then((isAdmin) => {
                assert(isAdmin == true);
                done();
            }).catch((err) => {
                log.error(err);
                assert(false);
                done();
            });
        });

        it('rfurman is IoT account admin', function(done) {
            var user = new User('rfurman@golder.com', dbMaster);
            user.isAdmin({account: 'IoT'}).then((isAdmin) => {
                assert(isAdmin == true);
                done();
            }).catch((err) => {
                log.error(err);
                assert(false);
                done();
            });
        });

        it('dkottow as system admin is also IoT account admin', function(done) {
            var user = new User('rfurman@golder.com', dbMaster);
            user.isAdmin({account: 'IoT'}).then((isAdmin) => {
                assert(isAdmin == true);
                done();
            }).catch((err) => {
                log.error(err);
                assert(false);
                done();
            });
        });
        
        it('Timothy_Sullivan is database owner', function(done) {
            var user = new User('Timothy_Sullivan@golder.com', dbMaster);
            user.isAdmin({account: 'IoT', database: 'GolderWatch'}).then((isAdmin) => {
                assert(isAdmin == true);
                done();
            }).catch((err) => {
                log.error(err);
                assert(false);
                done();
            });
        });

        it('rfurman as IoT account admin is also db owner of IoT GolderWatch', function(done) {
            var user = new User('rfurman@golder.com', dbMaster);
            user.isAdmin({account: 'IoT', database: 'GolderWatch'}).then((isAdmin) => {
                assert(isAdmin == true);
                done();
            }).catch((err) => {
                log.error(err);
                assert(false);
                done();
            });
        });

        it('Leigh_Durland even though test account admin is not db owner of IoT GolderWatch', function(done) {
            var user = new User('Leigh_Durland@golder.com', dbMaster);
            user.isAdmin({account: 'IoT', database: 'GolderWatch'}).then((isAdmin) => {
                assert(isAdmin == false);
                done();
            }).catch((err) => {
                log.error(err);
                assert(false);
                done();
            });
        });

        it('nobody is not db owner', function(done) {
            var user = new User('nobody@golder.com', dbMaster);
            user.isAdmin({account: 'IoT', database: 'GolderWatch'}).then((isAdmin) => {
                assert(isAdmin == false);
                done();
            }).catch((err) => {
                log.error(err);
                assert(false);
                done();
            });
        });

    });
});

