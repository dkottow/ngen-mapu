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


function routeBaseUrl(dbUrls) {
	//serve the dbUrls found.
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
}

function loadDirectoryTree(rootDir) {
	log.info('Loading directory tree. Root dir ./' + rootDir);

	var dbUrls = [];

	dir.subdirs(rootDir, function(err, subDirs) {
		log.info('found ' + subDirs.length + ' subdirs.');

		var afterScanDirs = _.after(subDirs.length, function() {
			routeBaseUrl(dbUrls);
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
						var restController = new cc.Controller(app, dbPath, model);

						model.init(function() { 
							restController.init(); 
						});

						dbUrls.push(dbPath);
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


