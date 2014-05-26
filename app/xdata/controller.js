var _ = require('underscore');
var util = require('util')
var multer = require('multer');
var XDocument = require('./model').XDocument;

function Controller(app, url, dbModel)
{	
	this.app = app;
	this.base = url;
	this.dbModel = dbModel;

	this.init = function() {

		this.app.use(multer({ 
			  'dest': './xdocs-upload'
		}));

		this.app.post(url + ".xml", function(req, res) {			
			log.info(req.method + " " + req.url);
			if (req.files["xdoc"]) {
				var xdoc = new XDocument(req.files["xdoc"].path);
				log.debug(util.inspect(xdoc));
			} else {
				var err = new Error("G6_XDATA_UPLOAD_ERROR: No xdoc posted.");
				log.warn(err);
				res.send(400, err.message);
			}
			res.send("OK");
		});
	}
}

exports.Controller = Controller;

