
var path = require('path');
var program = require('commander');

require('dotenv').config(); 
var config = require('config');

var APP_PATH = path.join(process.cwd(), 'app');

var Schema = require(path.join(APP_PATH, 'Schema.js')).Schema;
var DatabaseFactory = require(path.join(APP_PATH, 'DatabaseFactory.js')).DatabaseFactory;
var SqlHelper = require(path.join(APP_PATH, 'SqlHelperFactory.js')).SqlHelperFactory.create();

var log = require(path.join(APP_PATH, 'log.js')).log;

program
    .arguments('<schema-file> <account-or-database>')
	.option("-p, --password <pass>", "database password")
	.action(function (schemaFile, accountOrDatabase, params) {
        var dbConfig = config.sql.connection;
        dbConfig.password = params.password || config.sql.connection.password;
        var account = SqlHelper.Schema.splitName(accountOrDatabase)[0];
        var db = account != accountOrDatabase 
            ? SqlHelper.splitName(accountOrDatabase)[1]
            : path.basename(process.argv[2], '.json');

        dbConfig.database = SqlHelper.Schema.fullName(account, db);

        createDatabase(process.argv[2], dbConfig);

    }).parse(process.argv);


function createDatabase(schemaFile, dbConfig) {
    var schema = new Schema();
    schema.jsonRead(schemaFile, function(err) {
        if (err) {
            log.error({err: err}, '...createDatabase()');
            return;
        }
        var database = DatabaseFactory.create(dbConfig);
        database.setSchema(schema.get());
        database.write(function(err) {
            if (err) {
                log.error({err: err}, '...createDatabase()');                
            }
            console.log('done.');            
        });
        
    });    
}

