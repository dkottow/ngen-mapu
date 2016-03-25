
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

	var soccerSchema = [
		 { "name": "Person"
		 , "row_alias": ["Name"]
		 , "fields": {
				  "id": {
					  "name": "id"
					, "type": "INTEGER"
					, "order": 0
				}
				, "Name": {
					  "name": "Name"
					, "type": "VARCHAR"
					, "order": 10
				}
				, "Country": {
					  "name": "Country"
					, "type": "VARCHAR"
					, "order": 20
				}
				, "DateOfBirth": {
					  "name": "DateOfBirth"
					, "type": "DATE"
					, "order": 30
				}
				, "Role": {
					  "name": "Role"
					, "type": "VARCHAR(20)"
					, "order": 30
				}
				, "modified_by": {
					  "name": "modified_by"
					, "type": "VARCHAR(64)"
					, "order": 91
				}
				, "modified_on": {
					  "name": "modified_on"
					, "type": "DATETIME"
					, "order": 92
				}
			}		
		 }
	   , { "name": "Team"
		 , "row_alias": ["Name"]		  	
		 , "fields": {
				  "id": {
					  "name": "id"
					, "type": "INTEGER"
					, "order": 0
				}
				, "Name": {
					  "name": "Name"
					, "type": "VARCHAR"
					, "order": 1
				}
				, "Coach_id": {
					  "name": "Coach_id"
					, "type": "INTEGER"
					, "fk_table": "Person"
					, "order": 10
				}
				, "Captain_id": {
					  "name": "Captain_id"
					, "type": "INTEGER"
					, "fk_table": "Person"
					, "order": 11
				}
				, "modified_by": {
					  "name": "modified_by"
					, "type": "VARCHAR(64)"
					, "order": 91
				}
				, "modified_on": {
					  "name": "modified_on"
					, "type": "DATETIME"
					, "order": 92
				}
			}		
		 }
	   , { "name": "Player"
		 , "row_alias": ["Person.Name"]		  	
		 , "fields": {
				  "id": {
					  "name": "id"
					, "type": "INTEGER"
					, "order": 0
				}
				, "Team_id": {
					  "name": "Team_id"
					, "type": "INTEGER"
					, "fk_table": "Team"
					, "order": 1
				}
				, "Person_id": {
					  "name": "Person_id"
					, "type": "INTEGER"
					, "fk_table": "Person"
					, "order": 2
				}
				, "Position_id": {
					  "name": "Position_id"
					, "type": "INTEGER"
					, "fk_table": "Position"
					, "order": 10
				}
				, "modified_by": {
					  "name": "modified_by"
					, "type": "VARCHAR(256)"
					, "order": 91
				}
				, "modified_on": {
					  "name": "modified_on"
					, "type": "DATETIME"
					, "order": 92
				}
			}		
		 }
	   , { "name": "Position"
		 , "row_alias": ["Code"]		  	
		 , "fields": {
				  "id": {
					  "name": "id"
					, "type": "INTEGER"
					, "order": 0
				}
				, "Code": {
					  "name": "Code"
					, "type": "VARCHAR(2)"
					, "order": 10
				}
				, "Name": {
					  "name": "Name"
					, "type": "VARCHAR"
					, "order": 11
				}
				, "modified_by": {
					  "name": "modified_by"
					, "type": "VARCHAR(256)"
					, "order": 91
				}
				, "modified_on": {
					  "name": "modified_on"
					, "type": "DATETIME"
					, "order": 92
				}
			}		
		 }
	   , { "name": "Venue"
		 , "row_alias": ["Name"]		  	
		 , "fields": {
				  "id": {
					  "name": "id"
					, "type": "INTEGER"
					, "order": 0
				}
				, "Name": {
					  "name": "Name"
					, "type": "VARCHAR"
					, "order": 1
				}
				, "modified_by": {
					  "name": "modified_by"
					, "type": "VARCHAR(256)"
					, "order": 91
				}
				, "modified_on": {
					  "name": "modified_on"
					, "type": "DATETIME"
					, "order": 92
				}
			}		
		 }
	   , { "name": "Game"
		 , "row_alias": ["EventDate", "Venue.Name"]		  	
		 , "fields": {
				  "id": {
					  "name": "id"
					, "type": "INTEGER"
					, "order": 0
				}
				, "EventDate": {
					  "name": "EventDate"
					, "type": "DATE"
					, "order": 1
				}
				, "EventTime": {
					  "name": "EventTime"
					, "type": "DATETIME"
					, "order": 2
				}
				, "Venue_id": {
					  "name": "Venue_id"
					, "type": "INTEGER"
					, "fk_table": "Venue"
					, "order": 10
				}
				, "Team1_id": {
					  "name": "Team1_id"
					, "type": "INTEGER"
					, "fk_table": "Team"
					, "order": 20
				}
				, "Team2_id": {
					  "name": "Team2_id"
					, "type": "INTEGER"
					, "fk_table": "Team"
					, "order": 21
				}
				, "modified_by": {
					  "name": "modified_by"
					, "type": "VARCHAR(256)"
					, "order": 91
				}
				, "modified_on": {
					  "name": "modified_on"
					, "type": "DATETIME"
					, "order": 92
				}
			}		
		 }
	];

	describe('create()', function() {
		var dbFile = "./soccer.sqlite";
		
		before(function(done) {
			schema.Schema.remove(dbFile, function(err) {
				done();
			});
		});	

		it('create example', function(done) {
	
			var db = new schema.Schema(soccerSchema);
			db.init(function(err) {
console.log('init');
				if (err) {
					log.error(err);
					done();
				} else {
					db.create(dbFile, function(err) {
						log.info(err);
						done();	
					});
				}
			});

		});
	});

});


