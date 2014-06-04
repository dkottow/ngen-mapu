var _ = require('underscore');
var util = require('util')
var multer = require('multer');
var fork = require('child_process').fork;
var XDocument = require('./model').XDocument;

function Controller(app, url, dbFile)
{	
	this.app = app;
	this.base = url;
	this.dbFile = dbFile;

	this.init = function() {

		this.app.use(multer({ 
			  'dest': './xdocs-upload'
		}));

		var me = this;
		this.app.post(url + ".xml", function(req, res) {			
			log.info(req.method + " " + req.url);
			if (req.files["xdoc"]) {
				var xmlFile = req.files["xdoc"].path;
console.log(process.cwd);
				fork('./app/xdata/post', [xmlFile, me.dbFile]);
				
				/*
				var xdoc = new XDocument(req.files["xdoc"].path);
				log.debug(util.inspect(xdoc));
				*/
				res.send("OK"); //link to status file
			} else {
				var err = new Error("G6_XDATA_UPLOAD_ERROR: No xdoc posted.");
				log.warn(err);
				res.send(400, err.message);
			}
		});
	}
}

exports.Controller = Controller;

