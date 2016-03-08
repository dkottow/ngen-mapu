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

global.log = global.log || require('bunyan').createLogger({
	name: 'g6.server',
	level: 'debug',
	src: true,
	stream: process.stderr
});

global.tmp_dir = global.tmp_dir || '.';

//console.log('TMP DIR ' + tmp_dir);

var USE_VIEW = true;

Schema = function(tableDefs) {

	this.tableDefs = tableDefs;
}

Schema.prototype.init = function(cbAfter) {
	try {

		var tables = _.map(this.tableDefs, function(tableDef) {
			return new Table(tableDef);
		});

		this.graph = new TableGraph(tables);
		this.sqlBuilder = new SqlBuilder(this.graph);

	} catch(err) {
		log.warn("Error in Schema.init " + err);
		//throw err;
		cbAfter(err);
		return;
	}
	cbAfter();
}

Schema.prototype.tables = function() {
	if ( ! this._tables) {
		this._tables = this.graph.tables();
	}
	return this._tables;
}

Schema.prototype.get = function() {

	var tableDefs = _.map(this.tables(), function(table) {
		return this.graph.tableJSON(table);
	}, this);

	tableDefs = _.object(_.pluck(tableDefs, 'name'), tableDefs);
	return {
		'tables': tableDefs,
		'joins': []
	};		
}

/******* start file ops *******/

Schema.prototype.create = function(dbFile, cbAfter) {
	var me = this;
	var tmpFile = path.join(global.tmp_dir,
						tmp.tmpNameSync({template: 'dl-XXXXXX.sqlite'}));

	var db = new sqlite3.Database(tmpFile 
		, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE
		, function(err) {
			if (err) {
				cbAfter(err);
				return;
			}
			db.exec(me.sqlBuilder.createSQL(), function(err) {
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
			db.close();
	});
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

		var fields = _.map(Table.TABLE_FIELDS, function(f) {
			return '"' + f + '"';
		});
		var sql = 'SELECT ' + fields.join(',') 
				+ ' FROM ' + Table.TABLE;

		//read table properties 
		db.all(sql, function(err ,rows) {

			if (err) { 
				log.error("Get table defs failed. " + err);
				cbAfter(err);
				return;
			} 

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
				
				var tableNames = _.uniq(_.pluck(rows, 'table_name'));

				_.each(tableNames, function(tn) {
					tables[tn]['fields'] = {};
				});

				_.each(rows, function(r) {
					tables[r.table_name].fields[r.name] = r;
				});


				var doAfter = _.after(2*tableNames.length, function() {
					//after executing two SQL statements per table
					me.tableDefs = tables;
					me.init(cbAfter);
				});

				//read field sql definition 
				_.each(tableNames, function(tn) {
					var sql = util.format("PRAGMA table_info(%s)", tn);
					//console.log(sql);
					db.all(sql, function(err, rows) {
						if (err) {
							log.error(sql + ' failed.');
							cbAfter(err, tables);
							return;

						} 
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
						if (err) {
							log.error(sql + ' failed.');
							cbAfter(err, tables);
							return;

						}
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
}

exports.Schema = Schema;

