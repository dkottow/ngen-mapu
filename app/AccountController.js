var _ = require('underscore');

var fs = require('fs');
var path = require('path');
var util = require('util');
var url = require('url');

var Model = require('./model.js').Model;
var DatabaseController = require('./DatabaseController.js').DatabaseController;

var log = global.log.child({'mod': 'g6.AccountController.js'});

function AccountController(router, baseUrl, baseDir) {
	this.baseDir = baseDir;
	this.name = path.basename(baseDir);
	this.url = baseUrl;
	this.databaseControllers = {};

	console.log("url " + baseUrl);
	console.log("dir " + baseDir);

	this.init = function(cbAfter) {
		var me = this;

		//serve all databases
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
				var model = new Model(dbFile);
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

			var dirDefs = {};
			_.each(me.databaseControllers, function(c) {
				c.model.getSchema(function(err, tableDefs) {
					dirDefs[c.base] = tableDefs;
					if (_.keys(dirDefs).length == 
						_.keys(me.databaseControllers).length) {
							res.send(dirDefs);
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
			var parsedUrl = url.parse(req.url);
			var dbUrl = util.format('%s/%s'
						, me.url
						, schema.name
				);
			var dbFile = util.format('%s/%s' 
						, me.baseDir
						, schema.name + global.sqlite_ext
				);

			var model = new mm.Model(dbFile);
			model.createSchema(schema.tables, function(err) {
				if (err) {
					log.warn(req.method + " " + req.url + " failed.");
					res.send(400, err.message);
				} else {
					log.info(req.method + " " + req.url + " OK.");
					var controller = new cc.Controller(router, dbUrl, model);
					model.init(function() { 
						controller.init(function() {
							res.send("1"); //sends 1
						}); 
					});

					me.databaseControllers[dbUrl] = controller;
				}
			});
		}

		router.post(this.url, postSchemaHandler);	
		router.post(this.url + '.prj', postSchemaHandler);	

	}
}

exports.AccountController = AccountController;

