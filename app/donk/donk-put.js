#!/usr/bin/env node

/*
   Copyright 2016 Daniel Kottow

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
*/

var fs = require('fs');
var path = require('path');
var util = require('util');

var _ = require('underscore');

var program = require('commander');

var logger = require('../log.js');
//logger.winston.loggers.get('dl').remove(logger.winston.loggers.get('dl').transports.console);
var log = logger.log;

var parser = require('../QueryParser.js');
var Database = require('../Database.js').Database;

program
	.arguments('<db-file>')
	.option("-u, --update", "update existing rows only")
	.option("-t, --table <table>", "insert into this table. overwrites file table")
	.option("-U, --user <username>", "username that adds rows")
	.action(function (dbFile, params) {
		log.debug({ dbFile: dbFile }, 'donk-put()');

		var options = {};
		if (params.user) options.user = { name: params.user };
		if (params.table) options.table = params.table;

		var db = new Database(dbFile);

		db.init(function(err) {
			if (err) {
				console.error(err);
				return;
			}

			readStdIn(function(data) {
				log.debug({ data: data }, 'donk-put()');
			
				data = JSON.parse(data);
				var rows = data.rows;
				var table = options.table || data.table || data.query.table;				
				if ( ! db.table(table)) {
					console.error(util.format("Table '%s' not found.", table));
					return;
				}

				if (params.update) {
					db.update(table, rows, options, function(err, result) {
						if (err) {
							console.error(err);
							return;
						}
				
						log.trace(result);
						console.log(result);
					});
					
				} else {
					db.insert(table, rows, options, function(err, result) {
						if (err) {
							console.error(err);
							return;
						}
				
						log.trace(result);
						console.log(result);
					});
				}
			});

		});

	})
	.parse(process.argv);


function readStdIn(cbAfter) {
	var str = '';
	
	process.stdin.on('readable', function() {
		
		var chunk;
		process.stdin.setEncoding('utf8');
		while ((chunk = process.stdin.read())) {
			str += chunk;
		}
		
	});

	process.stdin.on('end', function() {
		cbAfter(str);		
	});
	
}
