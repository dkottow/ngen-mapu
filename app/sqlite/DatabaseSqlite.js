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
var tmp = require('tmp'); //tmp filenames
var config = require('config'); //tmp filenames

var Schema = require('../Schema.js').Schema;
var SchemaChange = require('../SchemaChange.js').SchemaChange;
var Database = require('../Database.js').Database;
var Field = require('../Field.js').Field;
var Table = require('../Table.js').Table;

var SqlBuilder = require('./SqlBuilderSqlite.js').SqlBuilderSqlite;
var SqlHelper = require('./SqlHelperSqlite.js').SqlHelperSqlite;

var log = require('../log.js').log;

var tempDir = config.tempDir;
if (! path.isAbsolute(tempDir)) tempDir = path.join(process.cwd(), tempDir);

var DatabaseSqlite = function(dbFile) 
{
	log.trace('new Database ' + dbFile);

	this.dbFile = dbFile;

	Database.call(this);
}

DatabaseSqlite.prototype = Object.create(Database.prototype);	

	
DatabaseSqlite.prototype.getCounts = function(cbResult) {
	log.trace("Database.getCounts()...");
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
				log.trace("...Database.getCounts()");
				cbResult(null, result);
			});
		});

	} catch(err) {
		log.error({err: err}, "Database.getCounts() exception. ");	
		cbResult(err, null);
	}
}

DatabaseSqlite.prototype.getStats = function(tableName, options, cbResult) {

	log.trace("Database.getStats()...");
	try {

		var table = this.table(tableName);

		cbResult = cbResult || arguments[arguments.length - 1];	
		options = typeof options == 'object' ? options : {};		

		var filterClauses = options.filter || [];
		var fields = options.fields || Table.ALL_FIELDS; 

		var sql = this.sqlBuilder.statsSQL(table, fields, filterClauses);
		var params = _.pluck(sql.params, 'value');
		
		var db = new sqlite3.Database(this.dbFile, sqlite3.OPEN_READONLY);
		db.get(sql.query, params, function(err, row) {
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
				log.trace("...Database.getCounts()");
				cbResult(null, result);
			});
		});

	} catch(err) {
		log.error({err: err}, "Database.getStats() exception.");	
		cbResult(err, null);
	}
}	

DatabaseSqlite.prototype.all = function(tableName, options, cbResult) {
	var me = this;
	log.trace("Database.all()...");
	try {

		cbResult = arguments[arguments.length - 1];	
		var sql = this.allSQL(tableName, options);

		var params = _.pluck(sql.params, 'value');

		var db = new sqlite3.Database(this.dbFile, sqlite3.OPEN_READONLY);

		db.all(sql.query, params, function(err, rows) {
			if (err) {
				db.close(function() {
					log.error({err: err, sql: sql},
						"Database.all() failed. ");	
					cbResult(err, null);
				});
			} else {
				log.trace({rows : rows});
				
				var countSql = sql.countSql 
					+ ' UNION ALL SELECT COUNT(*) as count FROM ' + tableName; 
				
				db.all(countSql, params, function(err, countRows) {
					db.close(function() {
						if (err) {
							log.error({err: err, sql: sql},
								"Database.all() failed. ");	
							cbResult(err, null);
						} else {
							result = me.allResult(tableName, rows, countRows, sql, options); 	
							cbResult(null, result);
						}
					});
				});
			}
		});

	} catch(err) {
		log.error({err: err}, "Database.all() exception.");	
		cbResult(err, null);
	}
}

DatabaseSqlite.prototype.get = function(tableName, options, cbResult) {

	try {

		var table = this.table(tableName);

		cbResult = cbResult || arguments[arguments.length - 1];	
		options = typeof options == 'object' ? options : {};		

		var filterClauses = options.filter || [];
		var fields = options.fields || Table.ALL_FIELDS; 

		var sql = this.sqlBuilder.selectSQL(table, fields, filterClauses, [], 1, 0, false);
		var params = _.pluck(sql.params, 'value');

		var db = new sqlite3.Database(this.dbFile, sqlite3.OPEN_READONLY);

		db.get(sql.query, params, function(err, row) {
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


DatabaseSqlite.prototype.insert = function(tableName, rows, options, cbResult) {

	try {
		log.trace('Database.insert()...');
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

		var fields = this.getInsertFields(rows, table);
		var fieldNames = _.keys(fields);
	
		var add_by = options.user.name(); 
		var own_by = options.user.principal(); 

		var fieldParams = _.times(fieldNames.length, function(fn) { 
			return "?"; 
		});

		var sql = "INSERT INTO " + table.name 
				+ '("' + fieldNames.join('", "') + '")'
				+ " VALUES (" + fieldParams.join(', ') + ");"

		log.debug({sql: sql}, "Database.insert()");

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

				r.add_on = r.mod_on = Field.dateToString(new Date());
				r.add_by = r.mod_by = add_by;
				r.own_by = r.own_by || own_by;
				//console.log(r);				
				if (err == null) {					

					var result = me.getFieldValues(r, fields);
					err = err || result.err;

					//console.log(result);
					stmt.run(result.values, function(e) { 
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

DatabaseSqlite.prototype.update = function(tableName, rows, options, cbResult) {

	try {
		log.trace('Database.update()...');
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

		var fields = this.getUpdateFields(rows, table);
		var fieldNames = _.keys(fields);

		var mod_by = options.user.name();

		var sql = "UPDATE " + table.name
				+ ' SET "' + fieldNames.join('" = ?, "') + '" = ?'
				+ " WHERE id = ?"; 

		log.debug({sql: sql}, "Database.update()");

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

				r.mod_on = Field.dateToString(new Date());
				r.mod_by = mod_by;

				if (err == null) {					

					var result = me.getFieldValues(r, fields);
					err = err || result.err;

					var params = result.values;
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

DatabaseSqlite.prototype.delete = function(tableName, rowIds, cbResult) {

	try {
		log.trace('Database.delete()...');
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

		log.debug({sql: sql}, "Database.delete()");

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
				var params = rowIds;
				stmt.run(params, function(e) { 
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

DatabaseSqlite.prototype.chown = function(tableName, rowIds, owner, cbResult) {
	try {
		log.trace('Database.chown()...');
		log.trace({table: tableName, rowIds: rowIds, owner: owner});

		var me = this;

		var table = this.table(tableName);
		if ( ! _.isArray(rowIds)) throw new Error("rowIds type mismatch");

		if (rowIds.length == 0) {
			cbResult(null, 0);
			return;
		}

		var db = new sqlite3.Database(this.dbFile, sqlite3.OPEN_READWRITE);
		
		db.serialize(function() {
			db.run("PRAGMA foreign_keys = ON;");
			db.run("BEGIN TRANSACTION");

			var err = null;
			var chownCount = 0;
			var chownTables = [ table ];

			while(err == null && chownTables.length > 0) {
				var t = chownTables.shift();

				var query = me.sqlBuilder.chownSQL(table, rowIds, t, owner);
				var params = _.pluck(query.params, 'value');

				log.debug({query: query}, "Database.chown()");

				db.run(query.sql, params, function(e) {
					err = err || e;
					chownCount += this.changes;
				});
			
				var childTables = me.childTables(t);
				chownTables = chownTables.concat(childTables);
			}

			if (err == null) {
				db.run("COMMIT TRANSACTION");
			} else {
				log.error({err: err, rowIds: rowIds, sql: sql}, 
					"Database.chown() failed. Rollback.");
				db.run("ROLLBACK TRANSACTION");
			}

			db.close(function() {
				cbResult(err, { rowCount: chownCount }); 
			});

		});


	} catch(err) {
		log.error({err: err, rowIds: rowIds}, "Database.chown() exception.");	
		cbResult(err, null);
	}
}

DatabaseSqlite.prototype.writeSchema = function(cbAfter) {
	var me = this;
	try {

		var opts = { viewSQL: true, searchSQL: true };
		var createSQL = SqlHelper.Schema.PragmaSQL 
					+ this.createSQL(opts);

		var tmpFile = path.join(tempDir,
						tmp.tmpNameSync({template: 'dl-XXXXXX.sqlite'}));

		var db = new sqlite3.Database(tmpFile 
			, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE
			, function(err) {
			if (err) {
				cbAfter(err);
				return;
			}
			db.exec(createSQL, function(err) {
				db.close(function(err) {
					if (err) {
						log.error("Schema.write() failed. " + err);	
						fs.unlink(tmpFile);
						cbAfter(err);
						return;
					}
					log.debug('rename ' + tmpFile + ' to ' + me.dbFile);	
					fs.rename(tmpFile, me.dbFile, function(err) {						
						cbAfter(err);
					});
				});
			});
		});

	} catch(err) {
		log.error({err: err}, "DatabaseSqlite.write() exception.");
		cbAfter(err);
	}
}

DatabaseSqlite.remove = function(dbFile, cbAfter) {
	fs.unlink(dbFile, function(err) {
		if (err) {
			log.error({err: err}, "DatabaseSqlite.remove() failed.");	
		}
		cbAfter(err);
	});
}

DatabaseSqlite.prototype.name = function() { 
	var fn = path.basename(this.dbFile);
	return fn.substr(0, fn.lastIndexOf('.')) || fn;
}

DatabaseSqlite.prototype.readSchema = function(cbAfter) {
	var me = this;

	try {
		log.debug({db: path.basename(me.dbFile)}, "Schema.read()");
		var db = new sqlite3.Database(me.dbFile
							, sqlite3.OPEN_READONLY
							, function(err) {
			if (err) {
				log.error({err: err, file: me.dbFile}, 
					"Schema.read() failed. Could not open file.");
				cbAfter(err);
				return;
			}

			var dbErrorHandlerFn = function(err) {
				if (err) {
					db.close();
					log.error({err: err}, util.format("Schema.read(%s) failed.", me.dbFile));
					cbAfter(err);
					return;
				}
			}

			var fields = _.map(Schema.TABLE_FIELDS, function(f) {
				return '"' + f + '"';
			});
			var sql = 'SELECT ' + fields.join(',') 
					+ ' FROM ' + Schema.TABLE;

			//read schema properties 
			db.all(sql, function(err, rows) {
				dbErrorHandlerFn(err);

				var schemaProps = {
					name: me.name()
				};
				
				_.each(rows, function(r) {
					schemaProps[r.name] = JSON.parse(r.value);
				});
				var fields = _.map(Table.TABLE_FIELDS, function(f) {
					return '"' + f + '"';
				});
				var sql = 'SELECT ' + fields.join(',') 
						+ ' FROM ' + Table.TABLE;

				//read table properties 
				db.all(sql, function(err, rows) {

					dbErrorHandlerFn(err);

					//handle empty schema
					if (rows.length == 0) {
						db.close(function() {
							me.setSchema(schemaProps);
							cbAfter();
							return;
						});
					}

					var tables = _.map(rows, function(r) {
						var table = { 
							name: r.name,
							disabled: r.disabled
						};
						var props =  JSON.parse(r.props);
						table.row_alias = props.row_alias;
						table.props = _.pick(props, Table.PROPERTIES);
						return table;
					});

					//console.dir(rows);
					tables = _.object(_.pluck(tables, 'name'), tables);
						
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
							var field = { 
								name: r.name,
								disabled: r.disabled
							};
							var props = JSON.parse(r.props);
							field.props = _.pick(props, Field.PROPERTIES);

							tables[r.table_name].fields[r.name] = field;
						});

						var doAfter = _.after(2*tableNames.length, function() {
							//after executing two SQL statements per table
							db.close(function () {
								var schemaData = {
									tables: tables
								};
								_.extend(schemaData, schemaProps);

								me.setSchema(schemaData);
								cbAfter();
							});
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
									tables[tn].fields[r.name].type = SqlHelper.Field.fromSQLType(r.type);
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
		});
	} catch(err) {
		log.error({err: err}, "Schema.read() exception.");
		cbAfter(err);
	}
}


DatabaseSqlite.prototype.writeSchemaChanges = function(changes, cbAfter) {
	var me = this;
	try {

		var changesSQL = _.reduce(changes, function(accSQL, change) {			
			var sql = change.toSQL(me.sqlBuilder).join('\n');
			return accSQL + sql + '; \n';
		}, '');

		changesSQL += _.reduce(changes, function(accSQL, change) {			
			var sql = change.afterSQL(me.sqlBuilder).join('\n');
			return accSQL + sql + '; \n';
		}, '');

		log.debug({changesSQL: changesSQL}, "DatabaseSqlite.writeSchemaChanges()");
		if (changesSQL.length == 0) {
			cbAfter();
			return;
		}

		var db = new sqlite3.Database(this.dbFile);

		try {

			db.serialize(function() {
				db.run("PRAGMA foreign_keys = ON;");
				db.run("BEGIN TRANSACTION");
				db.exec(changesSQL);
				db.run("COMMIT TRANSACTION");
				db.close(function() {
					cbAfter();
				});
			});

		} catch(err) {
			db.run("ROLLBACK TRANSACTION");
			db.close(function() {
				log.error({err: err, sql: sql}, 
					"DatabaseSqlite.writeSchemaChanges() exception. Rollback.");
				cbAfter(err);				
			});
		}

	} catch(err) {
		log.error({err: err}, 
			"DatabaseSqlite.writeSchemaChanges() exception.");
		cbAfter(err);
	}
}

exports.DatabaseSqlite = DatabaseSqlite;
