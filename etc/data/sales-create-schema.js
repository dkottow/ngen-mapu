
var APP_PATH = "../../app/";

var assert = require('assert')
	, _ = require('underscore')
	, util = require('util')
	, sqlite3 = require('sqlite3').verbose()
	, schema = require(APP_PATH + 'Schema')
	, Model = require(APP_PATH + 'Database').Database;
	
var log = require(APP_PATH + 'log').log;

//run me from root dir mocha etc/create-sales.js to create sales.sqlite

describe('Schema', function() {

	var salesSchema = {
		users : [ 
			{ "name": "anon@donkeylift.com", "role": "reader" } 
			, { "name": "demo@donkeylift.com", "role": "owner" }
			, { "name": "admin@donkeylift.com", "role": "owner" }
		],
		tables : [
			 { "name": "customers"
			 , "row_alias": ["name", "email"]
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
					, {
						  "name": "own_by"
						, "type": "VARCHAR(64)"
						, "props": {
							"order": 95
						}
					}
				 ]
			 }
		   , { "name": "products"
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
							"width": 30
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
					, {
						  "name": "own_by"
						, "type": "VARCHAR(64)"
						, "props": {
							"order": 95
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
							"order": 2
						  , "width": 40
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
					, {
						  "name": "own_by"
						, "type": "VARCHAR(64)"
						, "props": {
							"order": 95
						}
					}
				]		
			 }
		   , { "name": "products_in_orders"
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
							"order": 1
						  , "width": 40
						}
					}
					, {
						  "name": "product_id"
						, "type": "INTEGER"
						, "fk_table": "products"
						, "props": {
							"order": 2
						  , "width": 30
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
					, {
						  "name": "own_by"
						, "type": "VARCHAR(64)"
						, "props": {
							"order": 95
						}
					}
				]		
			 }
		]
	};		

	describe('Sales', function() {
		var dbFile = "./sales.sqlite";
		var jsonFile = "./sales.json";

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


