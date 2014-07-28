/*
	mocha tests - run me from parent dir
*/
var assert = require('assert')
	, _ = require('underscore')
	, Model = require('../app/model').Model
	, xdata = require('../xdata/model');


describe('XDoc', function() {
	//var dbFile = <dbschema>.<instance>.sqlite
	var dbFile = "test/gaslink.test.sqlite";
	var xmlFile = "test/DK_BH01A.XML";
	var xdoc = new xdata.XDocument(xmlFile);
	var model = new Model(dbFile);

	before(function(done) {
		model.init(done);
	});	

	describe('post()', function() {

		it('post', function(done) {
			this.timeout(10000); //10secs
			xdoc.post(model, function(err) { 
				if (err) {
					console.log("FAILED. ");
					console.log(err);
				}
				console.log("done.");
				done(); 
			});
		});


	});
	
});

