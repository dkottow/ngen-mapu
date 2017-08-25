

var assert = require('assert')
	, _ = require('underscore')
	, util = require('util')
	, graphlib = require('graphlib')
	, sqlite3 = require('sqlite3').verbose();

var APP_PATH = "../../app/";

var Database = require(APP_PATH + 'sqlite/DatabaseSqlite').DatabaseSqlite;
	
var log = require(APP_PATH + 'log').log;

//run me from root dir mocha etc/create-sales.js to create sales.sqlite

describe('Schema', function() {

	var soccerSchema = {
		name : 'soccer',
 		tables: [
		   { "name": "Team"
			 , "row_alias": ["Name"]		  	
			 , "fields": [
					{
						  "name": "id"
						, "type": "INTEGER"
						, "order": 0
					}
					, {
						  "name": "Name"
						, "type": "VARCHAR"
						, "order": 1
					}
					, {
						  "name": "Country"
						, "type": "VARCHAR"
						, "order": 1
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
			 , { "name": "Player"
			 , "row_alias": ["Name"]
			 , "fields": [
					{
						  "name": "id"
						, "type": "INTEGER"
						, "order": 0
					}
					, {
						  "name": "Name"
						, "type": "VARCHAR"
						, "order": 10
					}
					, {
						  "name": "Country"
						, "type": "VARCHAR"
						, "order": 20
					}
					, {
						  "name": "DateOfBirth"
						, "type": "DATE"
						, "order": 20
					}
					, {
						  "name": "Team_id"
						, "type": "INTEGER"
						, "order": 30
						, "fk_table": "Team"
					}
					, {
						  "name": "Role"
						, "type": "VARCHAR(20)"
						, "order": 31
					}
					, {
						  "name": "PreferredPosition_id"
						, "type": "INTEGER"
						, "fk_table": "Position"
						, "order": 10
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
		   , { "name": "Game"
			 , "row_alias": ["EventDate", "Venue.Name"]		  	
			 , "fields": [
					{
						  "name": "id"
						, "type": "INTEGER"
						, "order": 0
					}
					, {
						  "name": "EventDate"
						, "type": "DATE"
						, "order": 1
					}
					, {
						  "name": "EventTime"
						, "type": "VARCHAR(4)"
						, "order": 2
					}
					, {
						  "name": "Venue_id"
						, "type": "INTEGER"
						, "fk_table": "Venue"
						, "order": 10
					}
					, {
						  "name": "Team1_id"
						, "type": "INTEGER"
						, "fk_table": "Team"
						, "order": 20
					}
					, {
						  "name": "Team2_id"
						, "type": "INTEGER"
						, "fk_table": "Team"
						, "order": 21
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
		   , { "name": "Formation"
			 , "row_alias": ["Player.Name", "Game.EventDate"]		  	
			 , "fields": [
					{
						  "name": "id"
						, "type": "INTEGER"
						, "order": 0
					}
					, {
						  "name": "Player_id"
						, "type": "INTEGER"
						, "fk_table": "Player"
						, "order": 2
					}
					, {
						  "name": "Position_id"
						, "type": "INTEGER"
						, "fk_table": "Position"
						, "order": 10
					}
					, {
						  "name": "Game_id"
						, "type": "INTEGER"
						, "fk_table": "Game"
						, "order": 2
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
		   , { "name": "Position"
			 , "row_alias": ["Code"]		  	
			 , "fields": [
					{
						  "name": "id"
						, "type": "INTEGER"
						, "order": 0
					}
					, {
						  "name": "Code"
						, "type": "VARCHAR(2)"
						, "order": 10
					}
					, {
						  "name": "Name"
						, "type": "VARCHAR"
						, "order": 11
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
		   , { "name": "Venue"
			 , "row_alias": ["Name"]		  	
			 , "fields": [
					{
						  "name": "id"
						, "type": "INTEGER"
						, "order": 0
					}
					, {
						  "name": "Name"
						, "type": "VARCHAR"
						, "order": 1
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
			Database.remove(dbFile, function(err) {
				done();
			});
		});	

		it('create ' + dbFile, function(done) {
			this.timeout(5000);
	
			var db = new Database(dbFile);
			db.setSchema(soccerSchema);

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


