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

/*** end globals ***/

var logger = require('../log.js');
logger.winston.loggers.get('dl').remove(logger.winston.loggers.get('dl').transports.console);
var log = logger.log;

var parser = require('../QueryParser.js');
var Table = require('../Table.js').Table;
var Database = require('../sqlite/DatabaseSqlite.js').DatabaseSqlite;

program
	.arguments('<db-file> <table>')
	.option("-f, --filter <filters>", "query filters (use and keyword in between)")
	.option("-s, --select <fields>", "output fields (comma separated)")
	.option("-o, --orderby <ordering>", "order clauses (comma separated)")
	.option("--skip <n>", "number of rows to skip")
	.option("--top <n>", "number of rows to return")
	.action(function (dbFile, table, params) {
		log.debug({ dbFile: dbFile, table: table }, 'donk-get()');

		var options = {};
		if (params.filter) {
			options.filter = _.map(params.filter.split(' and '), function(f) { return f.trim(); });
			options.filter = parser.parse('$filter=' + options.filter.join('\t')).value;
		}
		if (params.select) {
			options.fields = _.map(params.select.split(','), function(f) { return f.trim(); });
			options.fields = parser.parse('$select=' + options.fields).value;
		}
		if (params.orderby) {
			options.order = parser.parse('$orderby=' + params.orderby).value;			
		}
		if (params.top) {
			options.limit = parser.parse('$top=' + params.top).value;			
		}
		if (params.skip) {
			options.offset = parser.parse('$skip=' + params.skip).value;			
		}
		if (params.debug) options.debug = 1;

		log.debug(util.inspect(options, false, null));		

		var db = new Database(dbFile);

		db.readSchema(function(err) {
			if (err) {
				console.error(err);
				return;
			}
			
			if ( ! db.table(table)) {
				console.error(util.format("Table '%s' not found.", table));
				return;
			}
			
			db.all(table, options, function(err, result) { 
				if (err) {
					console.error(err);
					return;
				}
		
				log.trace(result);
				console.log(JSON.stringify(result));
			});
		});

	})
	.parse(process.argv);


