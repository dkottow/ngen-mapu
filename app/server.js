var express = require('express');
var bodyParser = require('body-parser');
var _ = require('underscore');

var fs = require('fs');
var path = require('path');
var util = require('util');
var url = require('url');

var bunyan = require('bunyan');

//var logLevel = 'info';
var logLevel = 'debug';
global.log = bunyan.createLogger({
	'name': 'g6.server',
	'level': logLevel,
	'src': true
});

//max number of rows queried by any SELECT
global.row_max_count = 1000;
global.sqlite_ext = '.sqlite'

var AccountController = require('./AccountController.js').AccountController;

var app = express();

var log = global.log.child({'mod': 'g6.server.js'});

var config = {
	"ip"	:  null,
	"port"	: 3000, 
	"root"  : 'projects'
}

if (process.env.OPENSHIFT_DATA_DIR) {
	config.root = process.env.OPENSHIFT_DATA_DIR + config.root;
	config.ip = process.env.OPENSHIFT_NODEJS_IP;
	config.port = process.env.OPENSHIFT_NODEJS_PORT;
} else if (process.env.C9_USER) {
	config.ip = process.env.IP;
	config.port = process.env.PORT;
}

var accountControllers = {};
function serveAccounts(rootDir) {
	var router = new express.Router();
	fs.readdir(rootDir, function (err, files) {
    	if (err) {
        	throw err;
    	}

	    files.map(function (file) {
    	    return path.join(rootDir, file);
	    }).filter(function (file) {
    	    return fs.statSync(file).isDirectory();
	    }).forEach(function (dir, i, subDirs) {
			
			var url = "/" + path.basename(dir)
			var controller = new AccountController(router, url, dir);
			controller.init(function() {
				if (i == subDirs.length - 1) {
					router.get('/', function(req, res) {
						log.info(req.method + ' ' + req.url);
						res.send({
								'accounts':	
									_.map(accountControllers, function(ac) { 
										return ac.url;
									})	
						});
					});

					app.use('/', router);
					log.info('done.');
				}
			});
			accountControllers[controller.name] = controller;
		});
	});
}

if (config.ip) {
	app.listen(config.port, config.ip, function() {
		log.info("Started server on " + config.ip + ":" + config.port);
	});
} else {
	app.listen(config.port);
	log.info("Started server on localhost:" + config.port);
}

app.use(bodyParser.json()); //json parsing 

//enable CORS
app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header('Access-Control-Allow-Methods', 'GET, PUT, POST, DELETE'); 
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

serveAccounts(config.root);

app.get('/admin/reset', function(req, res) {
	//replace our express router by a new one calling serveDirectoryTree
	for(var i = 0;i < app._router.stack.length; ++i) {
		var route = app._router.stack[i];
		if (route.handle.name == 'router') {
			app._router.stack.splice(i, 1);
			serveDirectoryTree(config.root);
			break;
		}
	}
	res.send('done.');
});

app.use(function(err, req, res, next){
	log.error(err);
	res.send(500, err.stack);
});


