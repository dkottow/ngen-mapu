var _ = require('underscore');

var fs = require('fs');
var path = require('path');
var util = require('util');

var Schema = require('./Schema.js').Schema;
var Database = require('./Database.js').Database;
var DatabaseController = require('./DatabaseController.js')
								.DatabaseController;

var log = global.log.child({'mod': 'g6.AccountController.js'});

function sendError(req, res, err) {
	log.error(err);
	log.warn(req.method + " " + req.url + " failed.");
	res.send(400, err.message);
}

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

			var dbFiles = files.filter(function (file) {
				return (path.extname(file) == global.sqlite_ext);
			});

			dbFiles.forEach(function (file, i, files) {
				log.debug(file + " from " + files);
				var dbUrl = util.format('%s/%s' 
				  , me.url
				  , path.basename(file, global.sqlite_ext)
				);
				var dbFile = path.join(me.baseDir, file);					
				var model = new Database(dbFile);
				log.info('Serving ' + model.dbFile + " @ " + dbUrl);
				var controller = new DatabaseController(router, dbUrl, model);

				model.init(function() { 
					controller.init(function() {
						if (i == files.length - 1) cbAfter();
					}); 
				});

				me.databaseControllers[dbUrl] = controller;
			});

			//handle empty dir
			if (_.isEmpty(dbFiles)) cbAfter();

		});

		//serve list databases
		var getSchemaListHandler = function(req, res) {
			log.info(req.method + " " + req.url);

			var resBody = {
				name: me.name,
				databases: {}
			};

			var schemaDefs = {};
			var doAfter = _.after(_.size(me.databaseControllers), function() {
				res.send(resBody);
			});

			_.each(me.databaseControllers, function(c) {
				c.model.getSchema(function(err, schemaDef) {
					_.each(schemaDef.tables, function(t) { 
						delete t.fields; 
					});
					schemaDef.url = me.url + '/' + schemaDef.name;
					resBody.databases[schemaDef.name] = schemaDef;
					//schemaDefs[c.base] = schemaDef;
					doAfter();
				});
			});

			//handle empty account
			if (_.size(me.databaseControllers) == 0) res.send(resBody);
		}
			
		router.get(this.url, getSchemaListHandler);	
		router.get(this.url + '.prj', getSchemaListHandler);	

		//serve add database
		var postSchemaHandler = function(req, res) {
			log.info(req.method + " " + req.url);
			log.info({'req.body': req.body});

			var schema = req.body;
			var dbFile = util.format('%s/%s', me.baseDir,
								schema.name + global.sqlite_ext);

			var db = new Schema();
			db.init(schema.tables);

			db.create(dbFile, function(err) {
				if (err) {
					sendError(req, res, err);
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
						res.send({name: schema.name}); //return url of new database
					}); 
				});

				me.databaseControllers[dbUrl] = controller;
			});
		}

		router.post(this.url, postSchemaHandler);	
		router.post(this.url + '.prj', postSchemaHandler);	

		//serve put database
		var putSchemaHandler = function(req, res) {
			log.info(req.method + " " + req.url);
			log.info({'req.body': req.body});

			var schema = req.body;

			var meCtrl = me.databaseControllers[req.url];
			if ( ! meCtrl) {
				log.warn("schema " + req.url + " not found.");
				res.send(404, "schema " + req.url + " not found.");
				return;
			}
			meCtrl.model.getCounts(function(err, result) {
				if (err) {
					sendError(req, res, err);
					return;					
				}
				var totalRowCount = _.reduce(result, 
					function(memo, rows) { 
						return memo + rows; 
					}, 
				0);
				log.debug("total rows " + totalRowCount);
				if (totalRowCount > 0) {
					err = new Error("Database " + req.url + " not empty.");
					sendError(req, res, err);
					return;
				}
				var dbFile = meCtrl.model.dbFile;	
				var db = new Schema();
				db.init(schema.tables);
				db.create(dbFile, function(err) {
					if (err) {
						sendError(req, res, err);
						return;
					}

					log.info(req.method + " " + req.url + " OK.");
					meCtrl.model = new Database(dbFile);
					meCtrl.model.init(function() { 
						meCtrl.init( function() {
							res.send({}); 
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

			var meCtrl = me.databaseControllers[req.url];
			if ( ! meCtrl) {
				log.warn("schema " + req.url + " not found.");
				res.send(404, "schema " + req.url + " not found.");
				return;
			}

			meCtrl.model.getCounts(function(err, result) {
				if (err) {
					sendError(req, res, err);
					return;
					
				}
				var totalRowCount = _.reduce(result, 
					function(memo, rows) { 
						return memo + rows; 
					}, 
				0);
				log.debug("total rows " + totalRowCount);
			
				if (totalRowCount > 0) {
					err = new Error("Database " + req.url + " not empty.");	
					sendError(req, res, err);
					return;
				}

				var dbFile = meCtrl.model.dbFile;	
				Schema.remove(dbFile, function(err) {
					if (err) {
						sendError(req, res, err);
						return;
					}
					log.info(req.method + " " + req.url + " OK.");
					delete me.databaseControllers[req.url];
					res.send({});
				});
			});
		}

		router.delete(this.url + "/:schema", deleteSchemaHandler);	
		router.delete(this.url + '"/:schema.prj', deleteSchemaHandler);	

		//serve patch database
		var patchSchemaHandler = function(req, res) {
			log.info(req.method + " " + req.url);
			log.info({'req.body': req.body});

			var patches = req.body;
		}

		router.patch(this.url + "/:schema", patchSchemaHandler);	
		router.patch(this.url + '"/:schema.prj', patchSchemaHandler);	
	}


}

exports.AccountController = AccountController;

