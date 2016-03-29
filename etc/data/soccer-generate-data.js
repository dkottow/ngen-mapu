

var assert = require('assert')
	, _ = require('underscore')
	, util = require('util')
	, sqlite3 = require('sqlite3').verbose()
	, probdist = require('probdist')
	, Random = require('random-js');

var APP_PATH = "../../app/";

var Schema = require(APP_PATH + 'Schema').Schema
	, Database = require(APP_PATH + 'Database').Database;
	
var log = global.log;

//run me from root dir

describe('Database', function() {

	describe('create_teams()', function() {

		var dbFile = "soccer.sqlite";
		var db = new Database(dbFile);
		var rand =  new Random(Random.engines.mt19937().autoSeed());

		var teams, players;
		var qualifiedTeams;
		

		before(function(done) {
			db.init(function(err) {
				if (err) {
					log.info(err);
				} else {
					var allDone = _.after(2, function() {
						done();
					});
					db.all('Team', function(err, result) {
							log.info('got ' + result.rows.length + ' teams');
							teams = result.rows;
							qualifiedTeams = rand.sample(teams, 8);
							log.info("Qualified Teams");
							log.info(qualifiedTeams);
							allDone();
					});
					db.all('TeamMember', {
						filter: [{ 
							field: 'Role', 
							op: 'eq',
							value: 'Player'
						}]}, 
						function(err, result) {
							log.info('got ' + result.rows.length + ' players');
							players = result.rows;
							allDone();
					});
				}
			});
		});	

		it('assign player to teams', function(done) {
			this.timeout(90000);
			var teamIds = _.pluck(qualifiedTeams, 'id');
			rand.shuffle(players);
			for (var i = 0;i < players.length; ++i) {
				players[i].Team_id = teamIds[i % teamIds.length];
			}	
			db.update('TeamMember', players, function(err, c) {
				done();
			});
		});



		function randBetweenGauss(min, max, sigma) {
			var pg = probdist.gaussian(0, sigma);
			var s = min + Math.abs(pg.sample(1));
			//console.log(s);
			return Math.min(Math.max(min, Math.round(s)), max);
		}


	});

});


