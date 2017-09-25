
var APP_PATH = "../../app/";

var assert = require('assert')
	, _ = require('underscore')
	, util = require('util')
	, sqlite3 = require('sqlite3').verbose()
	, Database = require(APP_PATH + 'sqlite/DatabaseSqlite').DatabaseSqlite;
	
var log = require(APP_PATH + 'log').log;

var salesDefs = require('./sales-defs.js');

//run me from root dir mocha etc/create-sales.js to create sales.sqlite

describe('Schema', function() {

	var salesSchema = salesDefs.schema;

	describe('Sales', function() {
		var dbFile = "./sales.sqlite";
		var jsonFile = "./sales.json";

		before(function(done) {
			Database.remove(dbFile, function(err) {
				done();
			});
		});	

		it('create ' + dbFile, function(done) {
			this.timeout(5000);
	
			var db = new Database(dbFile);
			db.setSchema(salesSchema);
			var allDone = _.after(2, function() {
				done();
			});
			db.writeSchema(function(err) {
				log.info(err);
				allDone();
			});
			db.schema.jsonWrite(jsonFile, function(err) {
				log.info(err);
				allDone();	
			});
		});
	});

});


