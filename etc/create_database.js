
var path = require('path');

var APP_PATH = path.join(process.cwd(), 'app');

var Schema = require(path.join(APP_PATH, 'Schema.js')).Schema;
var DatabaseFactory = require(path.join(APP_PATH, 'DatabaseFactory.js')).DatabaseFactory;

var log = require(path.join(APP_PATH, 'log.js')).log;

if (process.argv.length < 3) {
    console.log('provide json file with schema as argument.');
    return;
}

var config = {
	user: 'dkottow', 
	password: 'G0lderPass.73', 
	domain: 'GOLDER',
    server: 'localhost\\HOLEBASE_SI',     
};

var account = 'dev$';

createDatabase(process.argv[2], config);

function createDatabase(schemaFile, config) {
    var schema = new Schema();
    schema.jsonRead(schemaFile, function(err) {
        if (err) {
            log.error({err: err}, '...createDatabase()');
            return;
        }
        config.database = account +  path.basename(schemaFile, '.json');
        var database = DatabaseFactory.create(config);
        database.setSchema(schema.get());
        database.write(function(err) {
            if (err) {
                log.error({err: err}, '...createDatabase()');                
            }
            console.log('done.');            
        });
        
    });    
}

