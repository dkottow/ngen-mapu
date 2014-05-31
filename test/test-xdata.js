/*
	mocha tests - run me from parent dir
*/
var assert = require('assert')
	, _ = require('underscore')
	, Model = require('../app/rest/model').Model
	, xdata = require('../app/xdata/model');


describe('XDoc', function() {
	var dbFile = "test/gaslink.test.sqlite";
	var xmlFile = "test/DK_BH01A.XML";
	var xdoc = new xdata.XDocument(xmlFile);
	var model = new Model(dbFile);

	before(function(done) {
		model.init(done);
	});	

	describe('post()', function() {
		it('post', function(done) {
			xdoc.post(model, done);
		});
	});
	
});

