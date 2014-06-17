var express = require('express');
var bodyParser = require('body-parser');
var dir = require('node-dir');
var _ = require('underscore');

var fs = require('fs');
var path = require('path');
var util = require('util');

var bunyan = require('bunyan');

global.log = bunyan.createLogger({
	'name': 'g6.server',
	'level': 'info'
});

var mm = require('./rest/model.js');
var cc = require('./rest/controller.js');

var app = express();

var log = global.log.child({'mod': 'g6.server.js'});

var PROJECT_ROOTDIR = 'projects';

var dbUrls;
var restControllers;

function routeBaseUrl() {

	//list all dbUrls found.
	var baseDirs = _.uniq(_.map(dbUrls, function(url) {
		return url.substring(0, url.indexOf('/', 1));
	}));

	app.get('/', function(req, res) {
		log.info(req.method + ' ' + req.url);
		res.send({
			'databases': dbUrls,
			'dirs': baseDirs	
		});
	});

	_.each(baseDirs, function(dir) {
		var dirUrls = _.filter(dbUrls, function(dbUrl) {
			return dbUrl.indexOf(dir) == 0;
		});

		var getDirHandler = function(req, res) {
			log.info(req.method + " " + req.url);

			var dirDefs = {};

			_.each(dirUrls, function(url) {
				var c = restControllers[url];
				c.model.defs(function(err, tableDefs) {
					_.each(tableDefs, function(t) {
						delete t.fields;
					});
					dirDefs[url] = tableDefs;
					if (_.keys(dirDefs).length == dirUrls.length) {
						res.send(dirDefs);
					}
				});
			});
		}
		
		app.get(dir, getDirHandler);	
		app.get(dir + '.dir', getDirHandler);	

	});

}

function loadDirectoryTree(rootDir) {
	log.info('Loading directory tree. Root dir ./' + rootDir);

	dbUrls = [];
	restControllers = {};

	dir.subdirs(rootDir, function(err, subDirs) {
		log.info('found ' + subDirs.length + ' subdirs.');

		var afterScanDirs = _.after(subDirs.length, function() {
			routeBaseUrl();
		});

		subDirs.forEach( function(dir) {
			fs.readdir(dir, function(err, files) {
				log.info('Scanning ' + dir);
				files.forEach( function(f) {
					if (path.extname(f) == '.sqlite') {
						dbPath = util.format('/%s/%s' 
						  , path.relative('projects', dir).replace(/\\/, '/')
						  , path.basename(f, '.sqlite')
						);
						dbFile = dir + '/' + f;					
						var model = new mm.Model(dbFile);
						log.info('Serving ' + model.dbFile);
						var controller = new cc.Controller(app, dbPath, model);

						model.init(function() { 
							controller.init(); 
						});

						dbUrls.push(dbPath);
						restControllers[dbPath] = controller;
					}
				});
				afterScanDirs();
			});
		}); 
		log.info(subDirs);
	});
}

log.info('Listening on port 3000');
app.listen(3000);

app.use(bodyParser()); //json parsing 

loadDirectoryTree(PROJECT_ROOTDIR);

app.use(function(err, req, res, next){
	log.error(err);
	res.send(500, err.stack);
});


