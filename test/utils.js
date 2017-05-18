
var _ = require('underscore');

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

	var config;

	if (global.sql_engine == 'sqlite') {
		var testDataDir = "test/data/sqlite/";
		config = testDataDir + name + ".sqlite";
		log.debug({config: config}, 'creating sqlite db');
		Database.remove(config, function(err) {
			let db = new Database(config);
			doOptions(db, cbAfter);
			//cbAfter(null, db);
			return;
		});

	} else if (global.sql_engine == 'mssql') {
		config = {
			user: 'dkottow', 
			password: 'G0lderPass.72', 
			domain: 'GOLDER',
			server: 'localhost\\HOLEBASE_SI', 
			database: 'test#' + name
		};
		log.debug({config: config.database}, 'creating mssql db');
		Database.remove(config, config.database, function(err) {
			let db = new Database(config);
			doOptions(db, cbAfter);
			return;	
		});
	}

	cbAfter(new Error('sql not supported'));
}

module.exports = {
    funcs: { createDatabase: createDatabase }
}