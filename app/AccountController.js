var _ = require('underscore');

var fs = require('fs');
var path = require('path');
var util = require('util');

var Schema = require('./Schema.js').Schema;
var Database = require('./Database.js').Database;
var DatabaseController = require('./DatabaseController.js').DatabaseController;

var log = global.log.child({'mod': 'g6.AccountController.js'});

function AccountController(router, baseUrl, baseDir) {
	this.baseDir = baseDir;
	this.name = path.basename(baseDir);
	this.url = baseUrl;
	this.databaseControllers = {};
	log.info("new AccountController @ " + this.url);

	this.init = function(cbAfter) {
		var me = this;

		//serve each database
		fs.readdir(baseDir, function(err, files) {
			log.info('Scanning ' + baseDir);

			if (err) {
				throw err;
			}

			files.filter(function (file) {
				return (path.extname(file) == global.sqlite_ext);
			}).forEach(function (file, i, files) {
				var dbUrl = util.format('%s/%s' 
				  , me.url
				  , path.basename(file, global.sqlite_ext)
				);
				var dbFile = path.join(me.baseDir, file);					
				var model = new Database(dbFile);
				log.info('Serving ' + model.dbFile);
				var controller = new DatabaseController(router, dbUrl, model);

				model.init(function() { 
					controller.init(function() {
						if (i == files.length - 1) cbAfter();
					}); 
				});

				me.databaseControllers[dbUrl] = controller;
			});
		});

		//serve list databases
		var getSchemaListHandler = function(req, res) {
			log.info(req.method + " " + req.url);

			var schemaDefs = {};
			_.each(me.databaseControllers, function(c) {
				c.model.getSchema(function(err, schemaDef) {
					_.each(schemaDef.tables, function(t) { 
						delete t.fields; 
					});
					schemaDefs[c.base] = schemaDef;
					if (_.keys(schemaDefs).length
						== _.keys(me.databaseControllers).length) {
							res.send(schemaDefs);
					}
				});
			});
		}
			
		router.get(this.url, getSchemaListHandler);	
		router.get(this.url + '.prj', getSchemaListHandler);	

		//serve add database
		var postSchemaHandler = function(req, res) {
			log.info(req.method + " " + req.url);
			log.info({'req.body': req.body});

			var schema = req.body;

			var dbFile = util.format('%s/%s' 
						, me.baseDir
						, schema.name + global.sqlite_ext
				);

			var db = new Schema(schema.tables);
			db.init(function(err) {
				if (err) {
					log.warn(req.method + " " + req.url + " failed.");
					res.send(400, err.message);
					return;
				}
				db.save(dbFile, function(err) {
					if (err) {
						log.warn(req.method + " " + req.url + " failed.");
						res.send(400, err.message);
						return;
					}
					log.info(req.method + " " + req.url + " OK.");
					var dbUrl = util.format('%s/%s'
								, me.url
								, schema.name
					);

					var model = new Database(dbFile);
					var controller = new DatabaseController(router, dbUrl, model);
					model.init(function() { 
						controller.init(function() {
							res.send("1"); //sends 1
						}); 
					});

					me.databaseControllers[dbUrl] = controller;
				});
			});
		}

		router.post(this.url, postSchemaHandler);	
		router.post(this.url + '.prj', postSchemaHandler);	

		//serve put database
		var putSchemaHandler = function(req, res) {
			log.info(req.method + " " + req.url);
			log.info({'req.body': req.body});

			var schema = req.body;

			var controller = me.databaseControllers[req.url];
			if ( ! controller) {
				log.warn("schema " + req.url + " not found.");
				res.send(404, "schema " + req.url + " not found.");
				return;
			}
			controller.model.getStats(function(err, result) {
				if (err) {
					log.warn(req.method + " " + req.url + " failed.");
					res.send(400, err.message);
					return;					
				}
				var totalRowCount = _.reduce(result, 
					function(memo, rows) { 
						return memo + rows; 
					}, 
				0);
				log.debug("total rows " + totalRowCount);
				if (totalRowCount > 0) {
					log.warn(req.method + " " + req.url + " failed.");
					err = new Error("Database " + req.url + " not empty.");	
					res.send(400, err.message);
					return;
				}
				var dbFile = controller.model.dbFile;	
				var db = new Schema(schema.tables);
				db.init(function(err) {
					if (err) {
						log.warn(req.method + " " + req.url + " failed.");
						res.send(400, err.message);
						return;	
					}
					Schema.remove(dbFile, function(err) {
						if (err) {
							log.warn(req.method + " " + req.url + " failed.");
							res.send(400, err.message);
							return;	
						}
						db.save(dbFile, function(err) {
							if (err) {
								log.warn(req.method + " " 
										+ req.url + " failed.");
								res.send(400, err.message);
								return;
							}

							log.info(req.method + " " + req.url + " OK.");
							var model = new Database(dbFile);
							controller.model = model;
							model.init(function() { 
								controller.init( function() {
									res.send("1"); //sends 1
								});
							});
						});
					});
				});
			});
		}

		router.put(this.url + "/:schema", putSchemaHandler);	
		router.put(this.url + '"/:schema.prj', putSchemaHandler);	


		//serve delete database
		var deleteSchemaHandler = function(req, res) {
			log.info(req.method + " " + req.url);

			var controller = me.databaseControllers[req.url];
			if ( ! controller) {
				log.warn("schema " + req.url + " not found.");
				res.send(404, "schema " + req.url + " not found.");
				return;
			}

			controller.model.getStats(function(err, result) {
				if (err) {
					log.warn(req.method + " " + req.url + " failed.");
					res.send(400, err.message);
					return;
					
				}
				var totalRowCount = _.reduce(result, 
					function(memo, rows) { 
						return memo + rows; 
					}, 
				0);
				log.debug("total rows " + totalRowCount);
			
				if (totalRowCount > 0) {
					log.warn(req.method + " " + req.url + " failed.");
					err = new Error("Database " + req.url + " not empty.");	
					res.send(400, err.message);
					return;
				}
				var dbFile = controller.model.dbFile;	
				Schema.remove(dbFile, function(err) {
					if (err) {
						log.warn(req.method + " " + req.url + " failed.");
						res.send(400, err.message);
						return;
					}
					log.info(req.method + " " + req.url + " OK.");
					delete me.databaseControllers[req.url];
					res.send("1");
				});
			});
		}

		router.delete(this.url + "/:schema", deleteSchemaHandler);	
		router.delete(this.url + '"/:schema.prj', deleteSchemaHandler);	
	}
}

exports.AccountController = AccountController;

