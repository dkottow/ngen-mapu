
var bunyan = require('bunyan');

global.log = bunyan.createLogger({
	'name': 'g6.xdata-post',
	'level': 'info'
});

var g6 = require('../app/rest/model');
var xdata = require('./model');
 
if (process.argv.length < 4) {
	console.log("Usage: node post.js <xmlFile> <dbFile>");
	process.exit(1);
}

var xmlFile = process.argv[2];
var dbFile = process.argv[3];

console.log("xmlFile " + xmlFile);
console.log("dbFile " + dbFile);
var xdoc = new xdata.XDocument(xmlFile);
var model = new g6.Model(dbFile);

model.init(function() {
	xdoc.post(model, function(err) {
		console.log("done. " + err);
	});
});


