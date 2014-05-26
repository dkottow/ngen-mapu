/*
	mocha tests - run me from parent dir
*/
var assert = require('assert')
	, _ = require('underscore')
	, Model = require('../app/rest/model').Model
	, xdata = require('../app/xdata/model');


describe('XDoc', function() {
	var dbFile = "test/gaslink.sqlite";
	var xmlFile = "test/DK_BH01A.XML";
	var xdoc = new xdata.XDocument(xmlFile);
	var model = new Model(dbFile);

	describe('post()', function() {
		xdoc.post(model);
	});
	
});

