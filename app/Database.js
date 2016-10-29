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
var _ = require('underscore');

var fs = require('fs');
var path = require('path');
var util = require('util');


var Table = require('./Table.js').Table;
var Schema = require('./Schema.js').Schema;
var DateTimeField = require('./Field.js').DateTimeField;

var log = global.log.child({'mod': 'g6.Database.js'});

global.row_max_count = global.row_count || 1000;
global.sqlite_ext = global.sqlite_ext || '.sqlite';

var Database = function(dbFile, options) 
{
	log.debug('new Database ' + dbFile);

	options = options || {};

	this.dbFile = dbFile;
	this.schema = options.schema || null;
}
	
Database.prototype.init = function(cbAfter) {
	this.schema = new Schema();
	this.schema.read(this.dbFile, cbAfter);
}

Database.prototype.name = function() { 
	return this.schema.name;
}

Database.prototype.table = function(name) { 
	return this.schema.table(name);
}

Database.prototype.user = function(name) { 
	return this.schema.user(name);
}

Database.prototype.tables = function() { 
	var tables = this.schema.tables();
	return _.object(_.pluck(tables, 'name'), tables); 
};

Database.prototype.users = function() { 
	var users = this.schema.users;
	return _.object(_.pluck(users, 'name'), users); 
}

Database.prototype.getInfo = function(options, cbResult) {

	cbResult = cbResult || arguments[arguments.length - 1];	
	options = typeof options == 'object' ? options : {};		

	var skipCounts = options.skipCounts || false;

	var result = this.schema.get();

	if (skipCounts) {
		cbResult(null, result);
		return;
	}
	
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

Database.prototype.isEmpty = function(cbResult) {
	this.getCounts(function(err, result) {
		if (err) {
			cbResult(err, null);
			return;	
		}
		
		var totalRowCount = _.reduce(result, 
			function(memo, tableRowCount) { 
				return memo + tableRowCount; 
			}, 
		0);

		cbResult(null, totalRowCount == 0);
	});
}

Database.prototype.getCounts = function(cbResult) {
	log.debug("Database.getCounts()...");
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

		var db = new sqlite3.Database(this.dbFile, sqlite3.OPEN_READONLY);
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
				log.debug("...Database.getCounts()");
				cbResult(null, result);
			});
		});

	} catch(err) {
		log.error({err: err}, "Database.getCounts() exception. ");	
		cbResult(err, null);
	}
}

Database.prototype.getStats = function(tableName, options, cbResult) {

	log.debug("Database.getStats()...");
	try {

		var table = this.table(tableName);

		cbResult = cbResult || arguments[arguments.length - 1];	
		options = typeof options == 'object' ? options : {};		

		var filterClauses = options.filter || [];
		var fields = options.fields || '*'; 

		var sql = this.schema.sqlBuilder.statsSQL(table, fields, filterClauses);
		
		var db = new sqlite3.Database(this.dbFile, sqlite3.OPEN_READONLY);
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
				log.debug("...Database.getCounts()");
				cbResult(null, result);
			});
		});

	} catch(err) {
		log.error({err: err}, "Database.getStats() exception.");	
		cbResult(err, null);
	}
}	

Database.prototype.all = function(tableName, options, cbResult) {

	log.debug("Database.all()...");
	try {

		var table = this.table(tableName);

		cbResult = cbResult || arguments[arguments.length - 1];	
		options = typeof options == 'object' ? options : {};		

		var filterClauses = options.filter || [];
		var fields = options.fields || '*'; 
		var order = options.order || [];
		var limit = options.limit || global.row_max_count;
		var offset = options.offset || 0;

		var debug = options.debug || false;

		log.trace(fields + " from " + table.name 
				+ " filtered by " + util.inspect(filterClauses));

		var sql = this.schema.sqlBuilder.selectSQL(table, fields, filterClauses, order, limit, offset);

		var db = new sqlite3.Database(this.dbFile, sqlite3.OPEN_READONLY);
		db.all(sql.query, sql.params, function(err, rows) {
			if (err) {
				db.close(function() {
					log.error({err: err, sql: sql},
						"Database.all() failed. ");	
					cbResult(err, null);
				});
			} else {
				log.trace({rows : rows});
				
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
							log.debug("...Database.all()");
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

		cbResult = cbResult || arguments[arguments.length - 1];	
		options = typeof options == 'object' ? options : {};		

		var filterClauses = options.filter || [];
		var fields = options.fields || '*'; 

		var sql = this.schema.sqlBuilder.selectSQL(table, fields, filterClauses, [], 1, 0, false);

		var db = new sqlite3.Database(this.dbFile, sqlite3.OPEN_READONLY);
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

Database.prototype.allById = function(tableName, rowIds, options, cbResult) {

	cbResult = cbResult || arguments[arguments.length - 1];	
	options = typeof options == 'object' ? options : {};		

	options.filter = options.filter || [];

	options.filter.push({
		field: 'id',
		op: 'in',
		value: rowIds
	});
	
	return this.all(tableName, options, cbResult);
} 

Database.prototype.rowsOwned = function(tableName, rowIds, user, cbResult) {
	log.debug({table: tableName, user: user}, 'Database.rowsOwned()...');
	log.trace({rowIds: rowIds},  'Database.rowsOwned()');
	
	var fields = ['id', 'add_by'];
	this.allById(tableName, rowIds, { fields: fields }, function(err, result) {
		if (err) {
			cbResult(err, null);
			return;
		}
		var notOwned = _.find(result.rows, function(row) {
			return row.add_by != user.name;	
		});

		log.debug({notOwned: notOwned}, '...Database.rowsOwned()');
		cbResult(null,  ! notOwned);	
	});
}

var parseFn = function(fieldType) {
	if (fieldType.indexOf('CHAR') >= 0) {
		return function(val) { return val; }
	} else if (fieldType.indexOf('NUMERIC') == 0) {
		return function(val) { return parseFloat(val); }
	} else if (fieldType == 'INTEGER') {
		return function(val) { return parseInt(val); }
	} else if (fieldType.indexOf('DATE') == 0) {
		return function(val) { 
			return Number.isFinite(Date.parse(val))
				? val : NaN; 
		}
	}
	throw new Error('unkown type ' + fieldType);
}
		
Database.prototype.getFieldParams = function(row, table, fieldNames) {
	var err = null;
	var params = _.map(fieldNames, function(fn) { 
		var t = table.field(fn).type;
		var val = row[fn] ? parseFn(t)(row[fn]) : null;
		if (t.indexOf('CHAR') < 0 && Number.isNaN(val)) {
			err = new Error('Conversion failed for ' 
				+ row[fn] + ' [' + fn + ']');
		}
		//console.log(val + ' ' + row[fn] + ' ' + fn + ' ' + t);
		return val; 
	});
	return { params: params, err: err };
}

Database.prototype.insert = function(tableName, rows, options, cbResult) {

	try {
		log.debug('Database.insert()...');
		log.trace({table: tableName, rows: rows, options: options});

		cbResult = cbResult || arguments[arguments.length - 1];	
		options = typeof options == 'object' ? options : {};		

		var returnModifiedRows = options.retmod || false;

		var table = this.table(tableName);
		if ( ! _.isArray(rows)) throw new Error("rows type mismatch");

		if (rows.length == 0) {
			cbResult(null, []);
			return;
		}

		var fieldNames = _.filter(_.keys(rows[0]), function(fn) { 
				//filter out any non-field key
				return _.has(table.fields, fn); // && fn != 'id'; 
		});

		fieldNames = _.union(fieldNames, Table.MANDATORY_FIELDS);
	
		var add_by = options.user ? options.user.name : 'unk';
		var mod_by = add_by;

		var fieldParams = _.times(fieldNames.length, function(fn) { 
			return "?"; 
		});

		var sql = "INSERT INTO " + table.name 
				+ '("' + fieldNames.join('", "') + '")'
				+ " VALUES (" + fieldParams.join(', ') + ");"

		log.debug(sql);

		var err = null;
		var rowIds = [];
		var db = new sqlite3.Database(this.dbFile, sqlite3.OPEN_READWRITE);
		var me = this;

		db.serialize(function() {
			db.run("PRAGMA foreign_keys = ON;");
			db.run("BEGIN TRANSACTION");

			var stmt = db.prepare(sql, function(e) {
				err = err || e;
			});

			_.each(rows, function(r) {

				r.add_on = r.mod_on = DateTimeField.toString(new Date());
				r.add_by = r.mod_by = mod_by;

				if (err == null) {					

					var result = me.getFieldParams(r, table, fieldNames);
					err = err || result.err;

					//console.log(result);
					stmt.run(result.params, function(e) { 
						err = err || e;
						rowIds.push(this.lastID);
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
						me.allById(tableName, rowIds, cbResult);
					} else {
						var rows = _.map(rowIds, function(id) { 
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
		log.debug('Database.update()...');
		log.trace({table: tableName, rows: rows, options: options});

		if (rows.length == 0) {
			cbResult(null, []);
			return;
		}

		var table = this.table(tableName);
		if ( ! _.isArray(rows)) throw new Error("rows type mismatch");

		cbResult = cbResult || arguments[arguments.length - 1];	
		options = typeof options == 'object' ? options : {};		

		var returnModifiedRows = options.retmod || false;

		var fieldNames = _.intersection(_.keys(rows[0]), _.keys(table.fields));
		fieldNames = _.without(fieldNames, 'id', 'add_by', 'add_on');
		fieldNames = _.union(fieldNames, ['mod_on', 'mod_by']);

		var mod_by = options.user ? options.user.name : 'unk';

		var sql = "UPDATE " + table.name
				+ ' SET "' + fieldNames.join('" = ?, "') + '" = ?'
				+ " WHERE id = ?"; 

		log.debug(sql);

		var err = null;
		var modCount = 0;	
		var db = new sqlite3.Database(this.dbFile, sqlite3.OPEN_READWRITE);
		var me = this;

		db.serialize(function() {
			db.run("PRAGMA foreign_keys = ON;");
			db.run("BEGIN TRANSACTION");

			var stmt = db.prepare(sql, function(e) {
				err = err || e;
			});

			_.each(rows, function(r) {

				r.mod_on = DateTimeField.toString(new Date());
				r.mod_by = mod_by;

				if (err == null) {					

					var result = me.getFieldParams(r, table, fieldNames);
					err = err || result.err;

					result.params.push(r.id);
					//console.log(params);

					stmt.run(result.params, function(e) {
						err = err || e;
						modCount += this.changes;
					});
				}
			});

			stmt.finalize(function() { 
				if (err == null && modCount != rows.length) {
					err = new Error("G6_MODEL_ERROR: Update row count mismatch. Expected " + rows.length + " got " + modCount);
				}

				if (err == null) {
					db.run("COMMIT TRANSACTION");

				} else {
					log.error({err: err, rows: rows, sql: sql}, 
						"Database.update() failed. Rollback. " + err);
					db.run("ROLLBACK TRANSACTION");
				}
				db.close(function() {
					var rowIds = _.pluck(rows, 'id');
					if (err == null && returnModifiedRows) {
						me.allById(tableName, rowIds, cbResult);
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

Database.prototype.delete = function(tableName, rowIds, cbResult) {

	try {
		log.debug('Database.delete()...');
		log.trace({table: tableName, rowIds: rowIds});

		var table = this.table(tableName);
		if ( ! _.isArray(rowIds)) throw new Error("rowIds type mismatch");

		if (rowIds.length == 0) {
			cbResult(null, []);
			return;
		}

		var idParams = _.times(rowIds.length, function(fn) { return "?"; });

		var sql = "DELETE FROM " + table.name 
				+ " WHERE id IN (" + idParams.join(', ') + ")";

		log.debug(sql);

		var err = null;
		var delCount = 0;
		var db = new sqlite3.Database(this.dbFile, sqlite3.OPEN_READWRITE);
		
		db.serialize(function() {
			db.run("PRAGMA foreign_keys = ON;");
			db.run("BEGIN TRANSACTION");

			var stmt = db.prepare(sql, function(e) {
				err = err || e;
			});

			if (err == null) 
			{
				stmt.run(rowIds, function(e) { 
					err = err || e;
					delCount = this.changes;
				});
			}

			stmt.finalize(function() { 
				if (err == null && delCount != rowIds.length) {
					//console.log(delCount + " <> " + rowIds.length);
					err = new Error("G6_MODEL_ERROR: Delete row count mismatch. Expected " + rowIds.length + " got " + delCount);
				}

				if (err == null) {
					db.run("COMMIT TRANSACTION");
				} else {
					log.error({err: err, rowIds: rowIds, sql: sql}, 
						"Database.delete() failed. Rollback.");
					db.run("ROLLBACK TRANSACTION");
				}
				db.close(function() {
					cbResult(err, rowIds); 
				});
			});	

		});

	} catch(err) {
		log.error({err: err, rowIds: rowIds}, "Database.delete() exception.");	
		cbResult(err, null);
	}
}

/* ex patches 
[
	{
					op: Schema.PATCH_OPS.SET_PROP
					, path: '/customers/name/width'
					, value: 20
	},
	{
					op: Schema.PATCH_OPS.SET_USER
					, path: '/user/demo@donkeylift.com'
					, value: { role: 'writer' }
	}
]
*/
Database.prototype.patchSchema = function(patches, cbResult) {
	try {
		var me = this;

		//take a schema copy 
		var patchedSchema = new Schema();
		patchedSchema.init(me.schema.get());

		//apply patches to schema copy 
		_.each(patches, function(patch) {
			patchedSchema.patch(patch);
		});	

		//write patches to database
		patchedSchema.writePatches(this.dbFile, patches, function(err) {
			if (err) {
				log.error({err: err, patches: patches}, 
					"Database.patchSchema() failed.");

				cbResult(err, null);
				return;
			}

			//apply patches to me
			me.schema.init(patchedSchema.get());

			//return patched schema
			me.getInfo(cbResult);
		});

	} catch(err) {
		log.error({err: err, patches: patches}, 
			"Database.patchSchema() exception.");	

		cbResult(err, null);
	}
}


exports.Database = Database;
