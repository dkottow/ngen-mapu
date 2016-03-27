var  fs = require('fs');
var  path = require('path');
var _ = require('underscore');
var util = require('util');
var assert = require('assert');

var tmp = require('tmp'); //tmp filenames

var sqlite3 = require('sqlite3').verbose();

var Field = require('./Field.js').Field;
var Table = require('./Table.js').Table;
var TableGraph = require('./TableGraph.js').TableGraph;
var SqlBuilder = require('./SqlBuilder.js').SqlBuilder;

var log = global.log.child({'mod': 'g6.Schema.js'});

global.tmp_dir = global.tmp_dir || '.';

var Schema = function(tableDefs) {

	this.tableDefs = tableDefs;
}

Schema.prototype.init = function(cbAfter) {
	try {

		var tables = _.map(this.tableDefs, function(tableDef) {
			return new Table(tableDef);
		});

		this.graph = new TableGraph(tables);
		this.sqlBuilder = new SqlBuilder(this.graph);

		cbAfter();

	} catch(err) {
		log.error("Schema.init() exception. " + err);
		//throw err;
		cbAfter(err);
	}
}

Schema.prototype.tables = function() {
	try {
		if ( ! this._tables) {
			this._tables = this.graph.tables();
		}
		return this._tables;

	} catch(err) {
		log.error("Schema.tables() exception. " + err);
		throw err;
	}
}

Schema.prototype.get = function() {

	try {
		var tableDefs = _.map(this.tables(), function(table) {
			return this.graph.tableJSON(table);
		}, this);

		tableDefs = _.object(_.pluck(tableDefs, 'name'), tableDefs);
		return {
			'tables': tableDefs,
			'joins': []
		};		

	} catch(err) {
		log.error("Schema.get() exception. " + err);
		throw err;
	}
}

/******* start file ops *******/

Schema.prototype.create = function(dbFile, cbAfter) {

	try {
		var createSQL = this.sqlBuilder.createSQL();

		var tmpFile = path.join(global.tmp_dir,
						tmp.tmpNameSync({template: 'dl-XXXXXX.sqlite'}));

		var db = new sqlite3.Database(tmpFile 
			, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE
			, function(err) {
			if (err) {
				cbAfter(err);
				return;
			}
			db.exec(createSQL, function(err) {
				db.close();
				if (err) {
					log.warn("Schema.create() failed. " + err);	
					fs.unlink(tmpFile);
					cbAfter(err);
					return;
				}
				log.debug('rename ' + tmpFile + ' to ' + dbFile);
				fs.rename(tmpFile, dbFile, function(err) {
					cbAfter(err);
				});
			});
		});

	} catch(err) {
		log.error("Schema.create() exception. " + err);
		cbAfter(err);
	}
}

Schema.remove = function(dbFile, cbAfter) {
	fs.unlink(dbFile, function(err) {
		if (err) {
			log.warn("Schema.remove() failed. " + err);	
		}
		cbAfter(err);
	});
}

Schema.prototype.read = function(dbFile, cbAfter) {

	try {
		log.debug("Schema.prototype.read " + dbFile);
		var me = this;
		var db = new sqlite3.Database(dbFile
							, sqlite3.OPEN_READWRITE
							, function(err) {
			if (err) {
				log.error("Schema.read() failed. Could not open '" 
					+ dbFile + "'");
				cbAfter(err);
				return;
			}

			var dbErrorHandlerFn = function(err) {
				if (err) {
					db.close();
					log.error("Schema.read() failed. " + err);
					cbAfter(err);
					return;
				}
			}

			var fields = _.map(Table.TABLE_FIELDS, function(f) {
				return '"' + f + '"';
			});
			var sql = 'SELECT ' + fields.join(',') 
					+ ' FROM ' + Table.TABLE;

			//read table properties 
			db.all(sql, function(err ,rows) {

				dbErrorHandlerFn(err);

				//console.dir(rows);
				var tables = _.object(_.pluck(rows, 'name'), rows);
				me.tableDefs = tables;

				//handle empty schema
				if (rows.length == 0) {
					me.init(cbAfter);
				}
					
				var fields = _.map(Field.TABLE_FIELDS, function(f) {
					return '"' + f + '"';
				});
				var sql = 'SELECT ' + fields.join(',') 
						+ ' FROM ' + Field.TABLE;

				//read field properties 
				db.all(sql, function(err ,rows) {
					
					dbErrorHandlerFn(err);

					var tableNames = _.uniq(_.pluck(rows, 'table_name'));

					_.each(tableNames, function(tn) {
						tables[tn]['fields'] = {};
					});

					_.each(rows, function(r) {
						tables[r.table_name].fields[r.name] = r;
					});

					var doAfter = _.after(2*tableNames.length, function() {
						//after executing two SQL statements per table
						db.close();
						me.tableDefs = tables;
						me.init(cbAfter);
					});

					//read field sql definition 
					_.each(tableNames, function(tn) {
						var sql = util.format("PRAGMA table_info(%s)", tn);
						//console.log(sql);
						db.all(sql, function(err, rows) {

							dbErrorHandlerFn(err);

							_.each(rows, function(r) {
								//console.log(r);
								_.extend(tables[tn].fields[r.name], r);	
							});
							doAfter();
						});
					});

					//read fk sql definition 
					_.each(tableNames, function(tn) {
						var sql = util.format("PRAGMA foreign_key_list(%s)", tn);
						db.all(sql, function(err, rows) {

							dbErrorHandlerFn(err);

							_.each(rows, function(r) {
								//console.log(r);
								_.extend(tables[tn].fields[r.from], {
									fk: 1,
									fk_table: r.table,
									fk_field: r.to
								});
							});
							doAfter();
						});
					});
				});
			});
		});
	} catch(err) {
		log.error("Schema.read() exception. " + err);
		cbAfter(err);
	}
}

exports.Schema = Schema;

