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


//var sqlite3 = require('sqlite3');
var sqlite3 = require('sqlite3').verbose();
var dir = require('node-dir');
var _ = require('underscore');

var fs = require('fs');
var path = require('path');
var util = require('util');


var Schema = require('./Schema.js').Schema;
var DateTimeField = require('./Field.js').DateTimeField;

var log = global.log.child({'mod': 'g6.Database.js'});

global.row_max_count = global.row_count || 1000;

var Database = function(dbFile) 
{
	log.debug('new Database ' + dbFile);

	//destroy cached DBs with this name
	//delete sqlite3.cached.objects[path.resolve(dbFile)];

	this.dbFile = dbFile;
	this.schema = null;
}
	
Database.prototype.init = function(cbAfter) {
	this.schema = new Schema();
	this.schema.read(this.dbFile, cbAfter);
}

Database.prototype.table = function(name) { 
	return this.schema.table(name);
}

Database.prototype.tables = function() { 
	var tables = this.schema.tables();
	return _.object(_.pluck(tables, 'name'), tables); 
};

Database.prototype.getSchema = function(cbResult) {
	var result = this.schema.get();
	result.name = path.basename(this.dbFile, global.sqlite_ext);
	this.getCounts(function(err, counts) {
		if (err) {
			cbResult(err, null);
		} else {
			_.each(result.tables, function(table) {
				table.row_count = counts[table.name];
			});
			cbResult(null, result);
		}
	});
}

Database.prototype.getCounts = function(cbResult) {

	try {
		//add row counts
		var sql = _.map(_.keys(this.tables()), function(tn) {
			return 'SELECT ' + "'" + tn + "'" + ' AS table_name' 
					+ ', COUNT(*) AS count'
					+ ' FROM "' + tn + '"';
		});
		sql = sql.join(' UNION ALL ');
		//console.dir(sql);

		var result = {};
		if (_.size(this.tables()) == 0) {
			cbResult(null, result);
			return;
		}

		var db = new sqlite3.Database(this.dbFile);
		db.all(sql, function(err, rows) {
			db.close(function() {
				if (err) {
					log.error({err: err}, "Database.getCounts() failed.");	
					cbResult(err, null);
					return;
				}
				_.each(rows, function(r) {
					result[r.table_name] = r.count;
				});
				cbResult(null, result);
			});
		});

	} catch(err) {
		log.error({err: err}, "Database.getCounts() exception. ");	
		cbResult(err, null);
	}
}

Database.prototype.getStats = function(tableName, options, cbResult) {

	try {

		var table = this.table(tableName);

		if (! cbResult) {
			//shift fn args
			cbResult = options;
			options = {};
		}

		options = options || {};		
		var filterClauses = options.filter || [];
		var fields = options.fields || '*'; 

		var sql = this.schema.sqlBuilder.statsSQL(table, fields, filterClauses);
		
		var db = new sqlite3.Database(this.dbFile);
		db.get(sql.query, sql.params, function(err, row) {
			db.close(function() {
				if (err) {
					log.error({err: err, sql: sql}, 
						"Database.get() failed.");
					cbResult(err, null);
					return;
				}
				var result = {};
				_.each(sql.sanitized.fields, function(f) {
					var min_key = 'min_' + f.alias;
					var max_key = 'max_' + f.alias;
					result[f.alias] = { 
						field: f.alias,
						min: row[min_key],
						max: row[max_key]
					};
				});
				cbResult(null, result);
			});
		});

	} catch(err) {
		log.error({err: err}, "Database.getStats() exception.");	
		cbResult(err, null);
	}
}	

Database.prototype.all = function(tableName, options, cbResult) {

	try {

		var table = this.table(tableName);
		if (! cbResult) {
			cbResult = options;
			options = {};
		}
		options = options || {};		

		var filterClauses = options.filter || [];
		var fields = options.fields || '*'; 
		var order = options.order || [];
		var limit = options.limit || global.row_max_count;
		var offset = options.offset || 0;

		var debug = options.debug || false;

		log.debug(fields + " from " + table.name 
				+ " filtered by " + util.inspect(filterClauses));

		var sql = this.schema.sqlBuilder.selectSQL(table, fields, filterClauses, order, limit, offset);

		var db = new sqlite3.Database(this.dbFile);

		db.all(sql.query, sql.params, function(err, rows) {
			if (err) {
				db.close(function() {
					log.error({err: err, sql: sql},
						"Database.all() failed. ");	
					cbResult(err, null);
				});
			} else {
				log.debug({rows : rows});
				
				var countSql = sql.countSql 
					+ ' UNION ALL SELECT COUNT(*) as count FROM ' + table.name; 
				
				db.all(countSql, sql.params, function(err, countRows) {
					db.close(function() {
						if (err) {
							log.error({err: err, sql: sql},
								"Database.all() failed. ");	
							cbResult(err, null);
						} else {
							var expectedCount = countRows[0].count - offset;

							var result = { 
								rows: rows, 
								count: countRows[0].count,
								totalCount: countRows[1].count
							}

							if (rows.length < expectedCount) {
								result.nextOffset = offset + limit;
							}

							if (debug) {
								result.sql = sql.query;
								result.sqlParams = sql.params;
							}		
							cbResult(null, result);
						}
					});
				});
			}
		});

	} catch(err) {
		log.error({err: err}, "Database.all() exception.");	
		cbResult(err, []);
	}
}

Database.prototype.get = function(tableName, options, cbResult) {

	try {

		var table = this.table(tableName);
		if (! cbResult) {
			cbResult = options;
			options = {};
		}
		options = options || {};		

		var filterClauses = options.filter || [];
		var fields = options.fields || '*'; 

		var sql = this.schema.sqlBuilder.selectSQL(table, fields, filterClauses, [], 1, 0, false);

		var db = new sqlite3.Database(this.dbFile);

		db.get(sql.query, sql.params, function(err, row) {
			db.close(function() {
				if (err) {
					log.error({err: err, sql: sql}, 
						"Database.get() failed.");	
				}

				//console.dir(row);
				cbResult(err, row);
			});
		});

	} catch(err) {
		log.error({err: err}, "Database.get() exception.");	
		cbResult(err, []);
	}
}

Database.prototype.allById = function(tableName, ids, cbResult) {
	var options = {
		filter: [{
			field: 'id',
			op: 'in',
			value: ids
		}]
	};	
	return this.all(tableName, options, cbResult);
} 

Database.prototype.insert = function(tableName, rows, options, cbResult) {

	try {

		if (! cbResult) {
			//shift fn args
			cbResult = options;
			options = {};
		}

		options = options || {};		

		var returnModifiedRows = options.retmod || false;

		var table = this.table(tableName);

		if (rows.length == 0) {
			cbResult(null, []);
			return;
		}

		var fieldNames = _.filter(_.keys(rows[0]), function(fn) { 
				//filter out any non-field key
				return _.has(table.fields, fn); // && fn != 'id'; 
		});

		var fieldParams = _.times(fieldNames.length, function(fn) { 
			return "?"; 
		});

		var sql = "INSERT INTO " + table.name 
				+ '("' + fieldNames.join('", "') + '")'
				+ " VALUES (" + fieldParams.join(', ') + ");"

		log.debug(sql);

		var err = null;
		var ids = [];
		var db = new sqlite3.Database(this.dbFile);
		var me = this;
		
		db.serialize(function() {
			db.run("PRAGMA foreign_keys = ON;");
			db.run("BEGIN TRANSACTION");

			var stmt = db.prepare(sql, function(e) {
				err = err || e;
			});

			_.each(rows, function(r) {
				if (err == null) {					

					var params = _.map(fieldNames, function(fn) { 
										return r[fn]; });
					//console.log(params);
					stmt.run(params, function(e) { 
						err = err || e;
						ids.push(this.lastID);
					});
				}
			});

			stmt.finalize(function() { 
				if (err == null) {
					db.run("COMMIT TRANSACTION");			
				} else {
					log.error({err: err, rows: rows, sql: sql}, 
						"Database.insert() failed. Rollback.");
					db.run("ROLLBACK TRANSACTION");
				}
				db.close(function() {
					if (err == null && returnModifiedRows) {
						me.allById(tableName, ids, cbResult);
					} else {
						var rows = _.map(ids, function(id) { 
							return { id: id };
						});
						cbResult(err, { rows: rows }); 
					}
				});
			});	
		});

	} catch(err) {
		log.error({err: err, rows: rows}, "Database.insert() exception.");	
		cbResult(err, []);
	}
}

Database.prototype.update = function(tableName, rows, options, cbResult) {

	try {

		var table = this.table(tableName);

		if (rows.length == 0) {
			cbResult(null, []);
			return;
		}

		if (! cbResult) {
			//shift fn args
			cbResult = options;
			options = {};
		}

		options = options || {};		
		var returnModifiedRows = options.retmod || false;

		var fieldNames = _.filter(_.keys(rows[0]) 
							, function(fn) { 
				return _.has(table.fields, fn) && fn != 'id'; 
		});

		if ( ! rows[0].mod_on) fieldNames.push('mod_on');

		var sql = "UPDATE " + table.name
				+ ' SET "' + fieldNames.join('" = ?, "') + '" = ?'
				+ " WHERE id = ?"; 

		log.debug(sql);

		var err = null;
		var modCount = 0;	
		var db = new sqlite3.Database(this.dbFile);
		var me = this;

		db.serialize(function() {
			db.run("PRAGMA foreign_keys = ON;");
			db.run("BEGIN TRANSACTION");

			var stmt = db.prepare(sql, function(e) {
				err = err || e;
			});

			_.each(rows, function(r) {

				r.mod_on = DateTimeField.toString(new Date());

				if (err == null) {					
					var params = _.map(fieldNames, function(fn) { return r[fn]; });
					params.push(r.id);
					//console.log(params);

					stmt.run(params, function(e) {
						err = err || e;
						modCount += this.changes;
					});
				}
			});

			stmt.finalize(function() { 
				if (err == null && modCount != rows.length) {
					err = new Error("G6_MODEL_ERROR: update row count mismatch. Expected " + rows.length + " got " + modCount);
				}

				if (err == null) {
					db.run("COMMIT TRANSACTION");

				} else {
					log.error({err: err, rows: rows, sql: sql}, 
						"Database.update() failed. Rollback. " + err);
					db.run("ROLLBACK TRANSACTION");
				}
				db.close(function() {
					var ids = _.pluck(rows, 'id');
					if (err == null && returnModifiedRows) {
						me.allById(tableName, ids, cbResult);
					} else {
						rows = _.map(rows, function(row) { 
							return { id: row.id };
						});
						cbResult(err, { 'rows': rows }); 
					}
				});
			});	
		});

	} catch(err) {
		log.error({err: err, rows: rows}, "Database.update() exception.");	
		cbResult(err, null);
	}
}

Database.prototype.delete = function(tableName, ids, cbResult) {

	try {

		var table = this.table(tableName);

		if (ids.length == 0) {
			cbResult(null, []);
			return;
		}

		var idParams = _.times(ids.length, function(fn) { return "?"; });

		var sql = "DELETE FROM " + table.name 
				+ " WHERE id IN (" + idParams.join(', ') + ")";

		log.debug(sql);

		var err = null;
		var delCount = 0;
		var db = new sqlite3.Database(this.dbFile);
		
		db.serialize(function() {
			db.run("PRAGMA foreign_keys = ON;");
			db.run("BEGIN TRANSACTION");

			var stmt = db.prepare(sql, function(e) {
				err = err || e;
			});

			if (err == null) 
			{
				stmt.run(ids, function(e) { 
					err = err || e;
					delCount = this.changes;
				});
			}

			stmt.finalize(function() { 
				if (err == null && delCount != ids.length) {
					//console.log(delCount + " <> " + ids.length);
					err = new Error("G6_MODEL_ERROR: delete row count mismatch");
				}

				if (err == null) {
					db.run("COMMIT TRANSACTION");
				} else {
					log.error({err: err, ids: ids, sql: sql}, 
						"Database.delete() failed. Rollback.");
					db.run("ROLLBACK TRANSACTION");
				}
				db.close(function() {
					cbResult(err, ids); 
				});
			});	

		});

	} catch(err) {
		log.error({err: err, ids: ids}, "Database.delete() exception.");	
		cbResult(err, null);
	}
}

Database.prototype.patchSchema = function(patches, cbResult) {
	try {

		//apply patches in memory
		_.each(patches, function(patch) {
			this.schema.patch(patch);
		});	

		//write patches to database
		this.schema.writePatches(this.dbFile, patches, function(err) {
			if (err) {
				log.error({err: err, patches: patches}, 
					"Database.patchSchema() failed.");

				//recover schema from disk
				this.schema.read(this.dbFile, function(e) {
					cbResult(err || e, null);
				});
				return;
			}
			//return new schema
			this.getSchema(cbResult);
		});

	} catch(err) {
		log.error({err: err, patches: patches}, 
			"Database.patchSchema() exception.");	
		cbResult(err, null);
	}
}
//}

exports.Database = Database;
