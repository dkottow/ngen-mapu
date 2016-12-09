
var APP_PATH = "../../app/";

var assert = require('assert')
	, _ = require('underscore')
	, util = require('util')
	, sqlite3 = require('sqlite3').verbose()
	, Schema = require(APP_PATH + 'Schema').Schema
	, Database = require(APP_PATH + 'Database').Database;
	
global.log = require('./log.js').log;
var log = global.log;

//run me from root dir mocha etc/create-sales.js to create sales.sqlite

describe('Schema', function() {

	var rentalsSchema = {
		users : [ 
			{ "name": "anon@donkeylift.com", "role": "reader" } 
			, { "name": "demo@donkeylift.com", "role": "owner" }
			, { "name": "admin@donkeylift.com", "role": "owner" }
		],
		tables : [
			 { "name": "quotes"
			 , "access_control": [
				{
					role: "reader",
					write: "own",
					read: "all"
				}			 
				, {
					role: "writer",
					write: "own",
					read: "all"
				}			 
			 ]
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
						  "name": "email"
						, "type": "VARCHAR"
						, "props": {
							"width": 30
						  , "order": 2
						}
					}
					, {
						  "name": "start_date"
						, "type": "DATE"
						, "props": {
							"order": 3
						}
					}
					, {
						  "name": "end_date"
						, "type": "DATE"
						, "props": {
							"order": 4
						}
					}
					, {
						  "name": "guest_count"
						, "type": "INTEGER"
						, "props": {
							"order": 5
						}
					}
					, {
						  "name": "quote"
						, "type": "NUMERIC"
						, "props": {
							"order": 6
						  , "scale": 2
						}
					}
					, {
						  "name": "status_id"
						, "type": "INTEGER"
						, "fk_table": "status"
						, "props": {
							"order": 7
						}
					}
					, {
						  "name": "mod_by"
						, "type": "VARCHAR"
						, "props": {
							"width": 20
						  , "order": 91
						}
					}
					, {
						  "name": "mod_on"
						, "type": "DATETIME"
						, "props": {
							"order": 92
						  , "width": 11
						}
					}
					, {
						  "name": "add_by"
						, "type": "VARCHAR"
						, "props": {
							"width": 20
						  , "order": 93
						}
					}
					, {
						  "name": "add_on"
						, "type": "DATETIME"
						, "props": {
							"order": 94
					      , "width": 11
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
		   , { "name": "guests"
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
						  "name": "email"
						, "type": "VARCHAR"
						, "props": {
							"width": 30
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
		   , { "name": "rentals"
			 , "row_alias": ["start_date", "guests.name"]		  	
			 , "fields": [
					{
						  "name": "id"
						, "type": "INTEGER"
						, "props": {
							"order": 0
						}
					}
					, {
						  "name": "guest_id"
						, "type": "INTEGER"
						, "fk_table": "guests"
						, "props": {
							"order": 2
						  , "width": 40
						}
					}
					, {
						  "name": "email"
						, "type": "VARCHAR"
						, "props": {
							"width": 30
						  , "order": 3
						}
					}
					, {
						  "name": "start_date"
						, "type": "DATE"
						, "props": {
							"order": 4
						}
					}
					, {
						  "name": "end_date"
						, "type": "DATE"
						, "props": {
							"order": 5
						}
					}
					, {
						  "name": "guest_count"
						, "type": "INTEGER"
						, "props": {
							"order": 6
						}
					}
					, {
						  "name": "price"
						, "type": "NUMERIC"
						, "props": {
							"order": 7
						  , "scale": 2
						}
					}
					, {
						  "name": "status_id"
						, "type": "INTEGER"
						, "fk_table": "status"
						, "props": {
							"order": 8
						}
					}
					, {
						  "name": "mod_by"
						, "type": "VARCHAR"
						, "props": {
							"width": 20
						  , "order": 91
						}
					}
					, {
						  "name": "mod_on"
						, "type": "DATETIME"
						, "props": {
							"order": 92
						  , "width": 11
						}
					}
					, {
						  "name": "add_by"
						, "type": "VARCHAR"
						, "props": {
							"width": 20
						  , "order": 93
						}
					}
					, {
						  "name": "add_on"
						, "type": "DATETIME"
						, "props": {
							"order": 94
					      , "width": 11
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
		   , { "name": "payments"
			 , "fields": [
					{
						  "name": "id"
						, "type": "INTEGER"
						, "props": {
							"order": 0
						}
					}
					, {
						  "name": "rental_id"
						, "type": "INTEGER"
						, "fk_table": "rentals"
						, "props": {
							"order": 1
						  , "width": 40
						}
					}
					, {
						  "name": "amount"
						, "type": "NUMERIC"
						, "props": {
							"scale": 2
						  , "order": 2
						}
					}
					, {
						  "name": "pay_date"
						, "type": "DATE"
						, "props": {
							"order": 3
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
		   , { "name": "status"
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

	describe('Rentals', function() {
		var dbFile = "./rentals.sqlite";
		var jsonFile = "./rentals.json";

		before(function(done) {
			Schema.remove(dbFile, function(err) {
				done();
			});
		});	

		it('create ' + dbFile, function(done) {
	
			var schema = new Schema();
			schema.init(rentalsSchema);
			var allDone = _.after(2, function() {
				done();
			});
			schema.write(dbFile, function(err) {
				log.info(err);
				//Add status
				var db = new Database(dbFile);
				db.init(function(err) {
					log.debug(err);
					var rows = [
						{ id: 0, name: 'closed'}
						, { id: 1, name: 'new'}
						, { id: 11, name: 'quote_confirmed'}
						, { id: 21, name: 'rental_reserved'}
					];
					db.insert('status', rows, function(err) {
						log.debug(err);
											
						allDone();	
					});	
				});
			});
			schema.jsonWrite(jsonFile, function(err) {
				log.info(err);
				allDone();	
			});
		});
	});

});


