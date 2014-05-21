var _ = require('underscore');
var util = require('util')
var multer = require('multer');

//stuff to handle xml files
var xpath = require('xpath')
  , dom = require('xmldom').DOMParser
  , fs = require('fs');


var log = global.log.child({'mod': 'g6.xdata-upload.js'});

function XDoc(docFile)
{
	this.doc = null;

	var me = this;
	function parse(file) {
		var xml = fs.readFileSync(file, {"encoding": "utf-8"});
		//console.log(xml);
		me.doc = new dom().parseFromString(xml);		
	}

	parse(docFile);
}

function XDocController(app, restUrl, model)
{	
	this.app = app;
	this.base = restBase;

	this.init = function() {

		this.app.use(multer({ 
			  'dest': './xdocs-upload'
		}));

		this.app.post(restUrl + ".xml", function(req, res) {			
			log.info(req.method + " " + req.url);
			if (req.files["xdoc"]) {
				var xdoc = new XDoc(req.files["xdoc"].path);
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

exports.XDocController = XDocController;

