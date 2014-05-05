var express = require('express');
var dir = require('node-dir')
var _ = require('underscore')

var fs = require('fs')
var path = require('path')
var util = require('util')

var bunyan = require('bunyan');

global.log = bunyan.createLogger({
	'name': 'g6.server',
	'level': 'info'
});

var mm = require('./model.js')
var cc = require('./controller.js')

var app = express();

var log = global.log.child({'mod': 'g6.server.js'});

function serveProjects(projectDir) {

	log.info("Root dir ./" + projectDir);
	dir.subdirs(projectDir, function(err, projects) {

		var dataBases = [];

		projects.forEach( function(projectDir) {
			fs.readdir(projectDir, function(err, files) {
				log.info("Scanning " + projectDir);
				files.forEach( function(f) {
					if (path.extname(f) == ".sqlite") {
						restBase = util.format("/rest/%s/%s" 
						  , path.relative("projects", projectDir).replace(/\\/, '/')
						  , path.basename(f, ".sqlite")
						);
						dbFile = projectDir + "/" + f;					
						log.info("Serving " + f + " @ " + restBase);
						var model = new mm.Model(dbFile);
						var controller = new cc.Controller(app, restBase, model);
						model.init(function() { 
							controller.init(); 
						});

						dataBases.push(restBase);
					}
				});
			});
		}); 

		app.get("/rest", function(req, res) {
			log.info(req.method + " " + req.url);
			res.send(dataBases);
		});

		log.info(projects);
	});
}

serveProjects("projects");

app.listen(3000);
app.use(express.json());

app.use(function(err, req, res, next){
  //console.error(err.stack);
	log.error(err);
	res.send(500, err.stack);
});

log.info("Listening on port 3000");
