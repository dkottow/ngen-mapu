

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

		var teams, coaches, players;
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
						if (err) throw new Error(err);
						log.info('got ' + result.rows.length + ' teams');
						teams = result.rows;
						allDone();
					});
					db.all('TeamMember', function(err, result) {
						if (err) throw new Error(err);
						log.info('got ' + result.rows.length + ' players');
						players = _.filter(result.rows, function(r) {
							return r.Role == 'Player';
						});
						coaches = _.filter(result.rows, function(r) {
							return r.Role == 'Coach';
						});
						allDone();
					});
				}
			});
		});	

		it('Qualifications. Assign all players to qualified teams. Delete unqualified coaches.', function(done) {
			this.timeout(5000);

			//Qualify teams.
			const qualifiedTeamCount = 8;
			qualifiedTeams = rand.sample(teams, qualifiedTeamCount);

			//assign an equal number of players to qual teams
			log.info(_.pluck(qualifiedTeams, 'Name'));
			var teamIds = _.pluck(qualifiedTeams, 'id');
			rand.shuffle(players);
			for (var i = 0;i < players.length; ++i) {
				players[i].Team_id = teamIds[i % teamIds.length];
			}

			//delete unqual coaches
			var disqualifiedCoaches = _.filter(coaches, function(c) {
				return ! _.contains(teamIds, c.Team_id);
			});
			log.info(_.pluck(disqualifiedCoaches, 'Name'));
			
			//update DB
			db.update('TeamMember', players, function(err, c) {
				if (err) throw new Error(err);
				db.delete('TeamMember', _.pluck(disqualifiedCoaches, 'id'), function(err, c) {
					if (err) throw new Error(err);
					done();	
				});
			});
		});

		it('Games. Start the tournament. Generate games and team formations', function(done) {
			//TODO
			done();
		});


		function randBetweenGauss(min, max, sigma) {
			var pg = probdist.gaussian(0, sigma);
			var s = min + Math.abs(pg.sample(1));
			//console.log(s);
			return Math.min(Math.max(min, Math.round(s)), max);
		}


	});

});


