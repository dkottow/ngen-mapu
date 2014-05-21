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

var mm = require('./model.js');
var cc = require('./controller.js');
var xdata = require('./xdata-upload.js');

var app = express();

var log = global.log.child({'mod': 'g6.server.js'});

var REST_ROOTDIR = "projects";


function loadDirectoryTree(rootDir) {
	log.info("Loading directory tree. Root dir ./" + rootDir);

	var dbUrls = [];

	dir.subdirs(rootDir, function(err, subDirs) {
		log.info("found " + subDirs.length + " subdirs.");

		var routeBaseUrl = _.after(subDirs.length, function() {
			//serve the dbUrls found.
			app.get("/rest", function(req, res) {
				log.info(req.method + " " + req.url);
				res.send(dbUrls);
			});
		});

		subDirs.forEach( function(dir) {
			fs.readdir(dir, function(err, files) {
				log.info("Scanning " + dir);
				files.forEach( function(f) {
					if (path.extname(f) == ".sqlite") {
						restBase = util.format("/rest/%s/%s" 
						  , path.relative("projects", dir).replace(/\\/, '/')
						  , path.basename(f, ".sqlite")
						);
						dbFile = dir + "/" + f;					
						log.info("Serving " + f + " @ " + restBase);
						var model = new mm.Model(dbFile);
						var controller = new cc.Controller(app, restBase, model);
						var xDocController = new xdata.XDocController(app, restBase, model);

						model.init(function() { 
							controller.init(); 
							xDocController.init();
						});

						dbUrls.push(restBase);
					}
				});
				routeBaseUrl();
			});
		}); 
		log.info(subDirs);
	});
}

log.info("Listening on port 3000");
app.listen(3000);

app.use(bodyParser()); //json parsing 

app.use(function(err, req, res, next){
	log.error(err);
	res.send(500, err.stack);
});

loadDirectoryTree(REST_ROOTDIR);

