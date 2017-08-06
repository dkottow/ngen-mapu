
var _ = require('underscore');
var config = require('config');

var DatabaseFactory = require('../app/DatabaseFactory').DatabaseFactory;
var Database = DatabaseFactory.getClass();
var log = require('./log.js').log;

function createDatabase(name, options, cbAfter) {

    cbAfter = cbAfter || options;

	var doOptions = function(db, cbAfter) {
		if (options.schema) {
			db.setSchema(options.schema);
			db.writeSchema(function(err) {
				if (err) {
					cbAfter(err);
					return;
				}
				if (options.data) {
//TODO
					var tables = _.keys(options.data);

                    var doInsert = _.reduce(tables, function(promises, table) {
                        return promises.then(result => {
                            return new Promise((resolve, reject) => {
                                db.insert(table, options.data[table], function(err, result) {
                                    if (err) reject(err);
                                    else resolve(result);
                                });
                            });
                        });    
                    }, Promise.resolve());

                    return doInsert.then(result => {
                        cbAfter(null, db);
                    });

				} else {
                    cbAfter(null, db);            
                }
			});
		} else {
            cbAfter(null, db);
        }		
	};

	if (config.sql.engine == 'sqlite') {
		var testDataDir = "test/data/sqlite/";
		var dbConfig = testDataDir + name + ".sqlite";
		log.debug({db: dbConfig}, 'creating sqlite db');
		Database.remove(dbConfig, function(err) {
			let db = new Database(dbConfig);
			doOptions(db, cbAfter);
			//cbAfter(null, db);
			return;
		});

	} else if (config.sql.engine == 'mssql') {
		var dbConfig = _.clone(config.sql.connection);
		dbConfig.database = 'test$' + name;

		log.debug({db: dbConfig.database}, 'creating mssql db');
		Database.remove(dbConfig, config.database, function(err) {
			let db = new Database(dbConfig);
			doOptions(db, cbAfter);
			return;	
		});
	}

	cbAfter(new Error('sql not supported'));
}

module.exports = {
    funcs: { createDatabase: createDatabase }
}