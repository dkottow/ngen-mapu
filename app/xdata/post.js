
var   g6 = require('../rest/model')
	, xdata = require('./model');

if (process.argv.length < 4) {
	console.log("Usage: node post.js <xmlFile> <dbFile>");
	process.exit(1);
}

var xmlFile = process.argv[2];
var dbFile = process.argv[3];

var xdoc = new xdata.XDocument(xmlFile);
var model = new g6.Model(dbFile);

model.init(function() {
	xdoc.post(model, function() {
		console.log("done.");
	});
});

