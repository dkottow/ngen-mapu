

var assert = require('assert')
	, _ = require('underscore')
	, util = require('util')
	, graphlib = require('graphlib')
	, sqlite3 = require('sqlite3').verbose();

var APP_PATH = "../../app/";

var Schema = require(APP_PATH + 'Schema').Schema
	, Model = require(APP_PATH + 'Database').Database;
	
var log = global.log;

//run me from root dir mocha etc/create-sales.js to create sales.sqlite

describe('Schema', function() {

	var soccerSchema = {
		users : [ { "name": "demo@donkeylift.com", "role": "reader" } ],
 		tables: [
		   { "name": "Team"
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
					, "Country": {
						  "name": "Country"
						, "type": "VARCHAR"
						, "order": 1
					}
					, "mod_by": {
						  "name": "mod_by"
						, "type": "VARCHAR(64)"
						, "order": 91
					}
					, "mod_on": {
						  "name": "mod_on"
						, "type": "DATETIME"
						, "order": 92
					}
				}		
			 }
			 , { "name": "Player"
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
						, "order": 20
					}
					, "Team_id": {
						  "name": "Team_id"
						, "type": "INTEGER"
						, "order": 30
						, "fk_table": "Team"
					}
					, "Role": {
						  "name": "Role"
						, "type": "VARCHAR(20)"
						, "order": 31
					}
					, "PreferredPosition_id": {
						  "name": "PreferredPosition_id"
						, "type": "INTEGER"
						, "fk_table": "Position"
						, "order": 10
					}
					, "mod_by": {
						  "name": "mod_by"
						, "type": "VARCHAR(64)"
						, "order": 91
					}
					, "mod_on": {
						  "name": "mod_on"
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
						, "type": "VARCHAR(4)"
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
					, "mod_by": {
						  "name": "mod_by"
						, "type": "VARCHAR(256)"
						, "order": 91
					}
					, "mod_on": {
						  "name": "mod_on"
						, "type": "DATETIME"
						, "order": 92
					}
				}		
			 }
		   , { "name": "Formation"
			 , "row_alias": ["Player.Name", "Game.EventDate"]		  	
			 , "fields": {
					  "id": {
						  "name": "id"
						, "type": "INTEGER"
						, "order": 0
					}
					, "Player_id": {
						  "name": "Player_id"
						, "type": "INTEGER"
						, "fk_table": "Player"
						, "order": 2
					}
					, "Position_id": {
						  "name": "Position_id"
						, "type": "INTEGER"
						, "fk_table": "Position"
						, "order": 10
					}
					, "Game_id": {
						  "name": "Game_id"
						, "type": "INTEGER"
						, "fk_table": "Game"
						, "order": 2
					}
					, "mod_by": {
						  "name": "mod_by"
						, "type": "VARCHAR(256)"
						, "order": 91
					}
					, "mod_on": {
						  "name": "mod_on"
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
					, "mod_by": {
						  "name": "mod_by"
						, "type": "VARCHAR(256)"
						, "order": 91
					}
					, "mod_on": {
						  "name": "mod_on"
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
					, "mod_by": {
						  "name": "mod_by"
						, "type": "VARCHAR(256)"
						, "order": 91
					}
					, "mod_on": {
						  "name": "mod_on"
						, "type": "DATETIME"
						, "order": 92
					}
				}		
			 }
		],
		join_trees: [
			{
				tables: [
					'Position'
					, 'Player'
					, 'Team'
				]
				, joins: [
					{v: 'Player', w: 'Position'}
					, {v: 'Player', w: 'Team'}
				]
			}
			, {
				tables: [
					'Venue'
					, 'Game'
					, 'Team'
				]
				, joins: [
					{v: 'Game', w: 'Venue'}
					, {v: 'Game', w: 'Team'}
				]
			}
			, {
				tables: [
					'Position'
					, 'Player'
					, 'Team'
					, 'Game'
					, 'Formation'
					, 'Venue'
				]
				, joins: [
					{v: 'Player', w: 'Team'}
					, {v: 'Formation', w: 'Player'}
					, {v: 'Formation', w: 'Position'}
					, {v: 'Formation', w: 'Game'}
					, {v: 'Game', w: 'Venue'}
				]
			}
		]
	};

	describe('Soccer', function() {
		var dbFile = "./soccer.sqlite";
		var jsonFile = "./soccer.json";
		
		before(function(done) {
			Schema.remove(dbFile, function(err) {
				done();
			});
		});	

		it('create ' + dbFile, function(done) {
			this.timeout(5000);
	
			var db = new Schema();
			db.init(soccerSchema);

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


