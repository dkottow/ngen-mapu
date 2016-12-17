

var assert = require('assert')
	, _ = require('underscore')
	, util = require('util')
	, sqlite3 = require('sqlite3').verbose()
	, probdist = require('probdist')
	, Random = require('random-js');

var APP_PATH = "../../app/";
global.log = require('./log.js').log;

var Schema = require(APP_PATH + 'Schema').Schema
	, Database = require(APP_PATH + 'Database').Database;
	
var log = require(APP_PATH + 'log').log;

//run me from root dir

describe('Database', function() {

	describe('create_teams()', function() {

		var dbFile = "soccer.sqlite";
		var db = new Database(dbFile);
		var rand =  new Random(Random.engines.mt19937().autoSeed());

		const tournamentStartDate = new Date('2016-06-02');
		var qualifiedTeams;

		var soccerData = {
		};


		before(function(done) {
			db.init(function(err) {
				if (err) {
					log.info(err);
				} else {
					var allDone = _.after(4, function() {
						log.info({soccerData: soccerData}, "before.init()");
						done();
					});
					db.all('Venue', function(err, result) {
						if (err) throw new Error(err);
						log.info('got ' + result.rows.length + ' venues');
						soccerData.venues = result.rows;
						allDone();
					});
					db.all('Team', function(err, result) {
						if (err) throw new Error(err);
						log.info('got ' + result.rows.length + ' teams');
						soccerData.teams = result.rows;
						allDone();
					});
					db.all('Player', function(err, result) {
						if (err) throw new Error(err);
						log.info('got ' + result.rows.length + ' players');
						soccerData.players = _.filter(result.rows, function(r) {
							return r.Role == 'Player';
						});
						allDone();
					});
					db.all('Position', function(err, result) {
						if (err) throw new Error(err);
						log.info('got ' + result.rows.length + ' positions');
						soccerData.positions = _.object(_.pluck(result.rows, 'id'), result.rows);
						soccerData.fieldPositions = _.filter(soccerData.positions, function(p) { return p.id < 20; });
						allDone();
					});
				}
			});
		});	

		it('Qualifications. Assign all players to qualified teams. Delete unqualified coaches.', function(done) {
			this.timeout(5000);

			var players = soccerData.players;
			var teams = soccerData.teams;
			var fieldPos = soccerData.fieldPositions;

			//Qualify teams.
			const qualifiedTeamCount = 8;
			qualifiedTeams = rand.sample(teams, qualifiedTeamCount);

			log.info({qualifiedTeams: _.pluck(qualifiedTeams, 'Name')});
			var qualIds = _.pluck(qualifiedTeams, 'id');

			var groupPlayers = _.groupBy(players, 'PreferredPosition_id');

			_.each(groupPlayers, function(posPlayers, pos) {
				rand.shuffle(posPlayers);
				for (var i = 0;i < posPlayers.length; ++i) {
					posPlayers[i].Team_id = qualIds[i % qualIds.length];
				}
			});

			//update DB
			db.update('Player', players, function(err, c) {
				if (err) throw new Error(err);
				done();
			});
		});

		it('Games. Start the tournament. Generate games.', function(done) {
			//TODO
			var games = [];
			var venues = soccerData.venues;
			var winners;
			var teams = qualifiedTeams;
			var eventDate = tournamentStartDate;
			var eventTimes = ['21:00', '19:00'];
			while (teams.length >= 2) {
				winners = [];
				var roundStartDate = new Date(eventDate);
				for(var gc = 0;gc < teams.length / 2; ++gc) {
					if (gc % eventTimes.length == 0 && gc > 0) {
						eventDate.setDate(eventDate.getDate() + 1);
					} 

console.log(eventDate);
					var i = gc * 2;
					var game = {
						EventDate: eventDate.toISOString().split('T')[0]
						, EventTime: eventTimes[gc % eventTimes.length]
						, Venue_id: 1 + (games.length % venues.length)
						, Team1_id: teams[i].id
						, Team2_id: teams[i+1].id
					};
					
					games.push(game);

					//play.. all we care about is the winner
					var winner = teams[i];

					winners.push(winner);
				}
				teams = winners;
				eventDate.setDate(roundStartDate.getDate() + 7);
			}

			log.debug(games);
			soccerData.games = games;

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
			var teams = soccerData.teams;
			var games = soccerData.games;
			var formations = [];

			_.each(games, function(game) {
				var team1 = _.findWhere(teams, {id: game.Team1_id});
				var team2 = _.findWhere(teams, {id: game.Team2_id});
				
				var fs = get_formations(game, team1, team2);
				formations = formations.concat(fs);
			});

			soccerData.formations = formations;
			db.insert('Formation', formations, function(err, ids) {
				if (err) throw new Error(err);
				done();	
			});

		});

		function get_formation(game, team) {
			console.log(game.EventDate + " " + team.Name);
			var players = soccerData.players;
			var allPos = soccerData.positions;
			var fieldPos = soccerData.fieldPositions;
			var posMatrix = {
				  'GK' : ['GK']
				, 'LB' : ['LB', 'DF', 'MF']
				, 'CB' : ['CB', 'DF', 'MF']
				, 'RB' : ['RB', 'DF', 'MF']
				, 'LM' : ['LM', 'MF', 'DF']
				, 'CM' : ['CM', 'MF', 'DF']
				, 'RM' : ['RM', 'MF', 'DF']
				, 'LW' : ['LW', 'FW']
				, 'RW' : ['RW', 'FW']
				, 'CF' : ['CF', 'FW']
				, 'SW' : ['SW', 'DF', 'MF']
			};
			var formation = [];
			var teamPlayers = _.where(players, {Team_id: team.id});

			_.each(fieldPos, function(pos) {

				var posOpts = posMatrix[pos.Code];
				var candidates = _.filter(teamPlayers, function(player) {
					var playerPos = allPos[player.PreferredPosition_id];
					return _.contains(posOpts, playerPos.Code);
				});
				rand.shuffle(candidates);
				var pickPlayer = _.find(candidates, function(player) {
					return ! _.find(formation, function(f) {
						return f.Player_id == player.id;
					});
				});

				if (pickPlayer) {

console.log(pos.Code + " - " + pickPlayer.Name + " " + allPos[pickPlayer.PreferredPosition_id]);
					formation.push({
							Player_id: pickPlayer.id
							, Position_id: pos.id
							, Game_id: game.id
					});

				} else {
					log.error({position: pos.Code, team: team.Name}, " no player found.");
				}
			});
			
			return formation;			
		}

		function get_formations(game, team1, team2) {
			//console.log(team1.Name + " vs " + team2.Name);
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


