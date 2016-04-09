

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

		const tournamentStartDate = new Date('2016-06-01');

		var teams, coaches, players;
		var qualifiedTeams;

		var positions, fieldPositions;
		
		var venues;
		var games, formations;
		
		before(function(done) {
			db.init(function(err) {
				if (err) {
					log.info(err);
				} else {
					var allDone = _.after(4, function() {
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
					db.all('Position', function(err, result) {
						if (err) throw new Error(err);
						log.info('got ' + result.rows.length + ' positions');
						positions = result.rows;
						fieldPositions = _.filter(positions, function(p) { return p.id < 20; });
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

			//delete disqualified
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

		it('Games. Start the tournament. Generate games.', function(done) {
			//TODO
			games = [];
			var winners;
			var round = qualifiedTeams;
			var eventDate = tournamentStartDate;
			var eventTimes = ['21:00', '19:00'];
			while (round.length >= 2) {
				winners = [];
				var roundStartDate = new Date(eventDate);
				for(var gc = 0;gc < round.length / 2; ++gc) {
					if (gc % eventTimes.length == 0 && gc > 0) {
						eventDate.setDate(eventDate.getDate() + 1);
					} 

					var i = gc * 2;
					var game = {
						EventDate: eventDate.toISOString().split('T')[0]
						, EventTime: eventTimes[gc % eventTimes.length]
						, Venue_id: 1 + (games.length % venues.length)
						, Team1_id: round[i].id
						, Team2_id: round[i+1].id
					};
					
					games.push(game);

					//play.. all we care about is the winner
					var winner = round[i];

					winners.push(winner);
				}
				round = winners;
				eventDate.setDate(roundStartDate.getDate() + 7);
			}

			log.debug(games);

			//update DB
			db.insert('Game', games, function(err, result) {
				if (err) throw new Error(err);
				var ids = result.rows;
				_.each(_.zip(games, ids), function(game_id) {
					game_id[0].id = game_id[1].id;
				});
				done();
			});
		});


		it('Formations. Pick 11 players from each team and each game.', function(done) {
			formations = [];

			_.each(games, function(game) {
				var team1 = _.find(teams, function(t) { 
					return t.id == game.Team1_id; 
				});
				var team2 = _.find(teams, function(t) { 
					return t.id == game.Team2_id; 
				});
				
				var fs = get_formations(game, team1, team2);
				formations = formations.concat(fs);
			});

			db.insert('Formation', formations, function(err, ids) {
				if (err) throw new Error(err);
				done();	
			});

		});

		function get_formation(game, team) {
			var formation = [];

			var i = 0;
			_.each(fieldPositions, function(p) {

				for(; i < players.length; ++i) {
					
					//TODO something more fancy, e.g. find a player who is close to position p
					if (players[i].Team_id == team.id) {
						
						formation.push({
							TeamMember_id: players[i].id
							, Position_id: p.id
							, Game_id: game.id
						});
						break;
					}
				}

				++i; //move on to next player
				
			});
			
			return formation;			
		}

		function get_formations(game, team1, team2) {

			var form1 = get_formation(game, team1);
			var form2 = get_formation(game, team2);

			return form1.concat(form2);
		}

		function randBetweenGauss(min, max, sigma) {
			var pg = probdist.gaussian(0, sigma);
			var s = min + Math.abs(pg.sample(1));
			//console.log(s);
			return Math.min(Math.max(min, Math.round(s)), max);
		}


	});

});


