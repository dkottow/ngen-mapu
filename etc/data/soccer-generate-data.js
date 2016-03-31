

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

		var venues;
		var games, formations;
		

		before(function(done) {
			db.init(function(err) {
				if (err) {
					log.info(err);
				} else {
					var allDone = _.after(3, function() {
						done();
					});
					db.all('Venue', function(err, result) {
						if (err) throw new Error(err);
						log.info('got ' + result.rows.length + ' venues');
						venues = result.rows;
						allDone();
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

			log.info(_.pluck(qualifiedTeams, 'Name'));
			var qualIds = _.pluck(qualifiedTeams, 'id');

			//assign an equal number of players to qual teams
			rand.shuffle(players);
			for (var i = 0;i < players.length; ++i) {
				players[i].Team_id = qualIds[i % qualIds.length];
			}

			//delete unqual
			var disqualifiedTeams = _.filter(teams, function(t) {
				return ! _.contains(qualIds, t.id);
			});

			var disqualifiedCoaches = _.filter(coaches, function(c) {
				return ! _.contains(qualIds, c.Team_id);
			});
			
			//update DB
			db.update('TeamMember', players, function(err, c) {
				if (err) throw new Error(err);

				var ids = _.pluck(disqualifiedCoaches, 'id');
				db.delete('TeamMember', ids, function(err, c) {
					if (err) throw new Error(err);

					var ids = _.pluck(disqualifiedTeams, 'id');
					db.delete('Team', ids, function(err, c) {
						if (err) throw new Error(err);
						done();	
					});
				});

			});
		});

		function get_formations(team1, team2) {
		}

		it('Games. Start the tournament. Generate games and team formations', function(done) {
			//TODO
			games = [];
			formations = [];
			var winners;
			var round = qualifiedTeams;
			while (round.length >= 2) {
				winners = [];
				for(var i = 0;i < round.length; i += 2) {
					games.push({
						EventDate: '2015-01-01'
						, EventTime: '21:30'
						, Venue_id: 1 + (games.length % venues.length)
						, Team1_id: round[i].id
						, Team2_id: round[i+1].id
					});

					var fs = get_formations(round[i], round[i+1]);
					formations = formations.concat(fs);

					//play.. all we care about is the winner
					var winner = round[i];

					winners.push(winner);
				}
				round = winners;
			}
			log.info(games);
			db.insert('Game', games, function(err, c) {
				if (err) throw new Error(err);
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


