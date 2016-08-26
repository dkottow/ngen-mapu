
var APP_PATH = "../../app/";

var assert = require('assert')
	, _ = require('underscore')
	, util = require('util')
	, sqlite3 = require('sqlite3').verbose()
	, schema = require(APP_PATH + 'Schema')
	, Model = require(APP_PATH + 'Database').Database;
	
var log = global.log;

//run me from root dir mocha etc/create-sales.js to create sales.sqlite

describe('Schema', function() {

	var salesSchema = {
		users : [ { "name": "demo@donkeylift.com", "role": "writer" } ],
		tables: [
			 { "name": "customers"
			 , "row_alias": ["name"]
			 , "fields": [
					{
						  "name": "id"
						, "type": "INTEGER"
						, "props": {
							"order": 0
						}
					}
					, {
						  "name": "name"
						, "type": "VARCHAR"
						, "width": 40
						, "props": {
							"order": 1
						}
					}
					, {
						  "name": "email"
						, "type": "VARCHAR(256)"
						, "props": {
							"width": 60
						  , "order": 2
						}
					}
					, {
						  "name": "mod_by"
						, "type": "VARCHAR(64)"
						, "props": {
							"order": 91
						}
					}
					, {
						  "name": "mod_on"
						, "type": "DATETIME"
						, "props": {
							"order": 92,
							"width": 11
						}
					}
					, {
						  "name": "add_by"
						, "type": "VARCHAR(64)"
						, "props": {
							"order": 93
						}
					}
					, {
						  "name": "add_on"
						, "type": "DATETIME"
						, "props": {
							"order": 94,
							"width": 11
						}
					}
				]		
			 }
		   , { "name": "sandwiches"
			 , "row_alias": ["name"]		  	
			 , "fields": [
					{
						  "name": "id"
						, "type": "INTEGER"
						, "props": {
							"order": 0
						}
					}
					, {
						  "name": "name"
						, "type": "VARCHAR"
						, "props": {
							"width": 40
						  , "order": 1
						}
					}
					, {
						  "name": "price"
						, "type": "NUMERIC(8,2)"
						, "props": {
							"scale": 2
						  , "order": 2
						}
					}
					, {
						  "name": "description"
						, "type": "VARCHAR"
						, "props": {
							"width": 80
						  , "order": 3
						}
					}
					, {
						  "name": "origin"
						, "type": "VARCHAR"
						, "props": {
							"width": 20
						  , "order": 4
						}
					}
					, {
						  "name": "mod_by"
						, "type": "VARCHAR(64)"
						, "props": {
							"order": 91
						}
					}
					, {
						  "name": "mod_on"
						, "type": "DATETIME"
						, "props": {
							"order": 92,
							"width": 11
						}
					}
					, {
						  "name": "add_by"
						, "type": "VARCHAR(64)"
						, "props": {
							"order": 93
						}
					}
					, {
						  "name": "add_on"
						, "type": "DATETIME"
						, "props": {
							"order": 94,
							"width": 11
						}
					}
				]		
			 }
		   , { "name": "orders"
			 , "row_alias": ["order_date", "customers.name"]		  	
			 , "fields": [
					{
						  "name": "id"
						, "type": "INTEGER"
						, "props": {
							"order": 0
						}
					}
					, {
						  "name": "order_date"
						, "type": "DATE"
						, "props": {
							"order": 1
						}
					}
					, {
						  "name": "customer_id"
						, "type": "INTEGER"
						, "fk_table": "customers"
						, "props": {
							"width": 40
						  , "order": 2
						}
					}
					, {
						  "name": "total_amount"
						, "type": "NUMERIC(8,2)"
						, "props": {
							"scale": 2
						  , "width": 12
						  , "order": 3
						}
					}
					, {
						  "name": "mod_by"
						, "type": "VARCHAR(64)"
						, "props": {
							"order": 91
						}
					}
					, {
						  "name": "mod_on"
						, "type": "DATETIME"
						, "props": {
							"order": 92,
							"width": 11
						}
					}
					, {
						  "name": "add_by"
						, "type": "VARCHAR(64)"
						, "props": {
							"order": 93
						}
					}
					, {
						  "name": "add_on"
						, "type": "DATETIME"
						, "props": {
							"order": 94,
							"width": 11
						}
					}
				]		
			 }
		   , { "name": "order_items"
			 , "fields": [
					{
						  "name": "id"
						, "type": "INTEGER"
						, "props": {
							"order": 0
						}
					}
					, {
						  "name": "order_id"
						, "type": "INTEGER"
						, "fk_table": "orders"
						, "props": {
							"width": 60
						  , "order": 1
						}
					}
					, {
						  "name": "sandwich_id"
						, "type": "INTEGER"
						, "fk_table": "sandwiches"
						, "props": {
							"width": 40
						  , "order": 2
						}
					}
					, {
						  "name": "unit_price"
						, "type": "NUMERIC(8,2)"
						, "props": {
							"scale": 2
						  , "order": 3
						}
					}
					, {
						  "name": "quantity"
						, "type": "INTEGER"
						, "props": {
							"order": 4
						}
					}
					, {
						  "name": "mod_by"
						, "type": "VARCHAR(64)"
						, "props": {
							"order": 91
						}
					}
					, {
						  "name": "mod_on"
						, "type": "DATETIME"
						, "props": {
							"order": 92,
							"width": 11
						}
					}
					, {
						  "name": "add_by"
						, "type": "VARCHAR(64)"
						, "props": {
							"order": 93
						}
					}
					, {
						  "name": "add_on"
						, "type": "DATETIME"
						, "props": {
							"order": 94,
							"width": 11
						}
					}
				]		
			 }
		]
	};
	
	describe('Sandwiches', function() {
		var dbFile = "./sandwiches.sqlite";
		var jsonFile = "./sandwiches.json";
		
		before(function(done) {
			schema.Schema.remove(dbFile, function(err) {
				done();
			});
		});	

		it('create ' + dbFile, function(done) {
	
			var db = new schema.Schema();
			db.init(salesSchema);
			var allDone = _.after(2, function() {
				done();
			});
			db.write(dbFile, function(err) {
				log.info(err);
				allDone();	
			});
			db.jsonWrite(jsonFile, function(err) {
				log.info(err);
				allDone();	
			});
		});
	});

});


