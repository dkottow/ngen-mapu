
//var sqlite3 = require('sqlite3');
var sqlite3 = require('sqlite3').verbose();
var dir = require('node-dir');
var _ = require('underscore');

var fs = require('fs');
var path = require('path');
var util = require('util');

var assert = require('assert');

var Schema = require('./Schema.js').Schema;

if (global.log) {
	var log = global.log.child({'mod': 'g6.Database.js'});
	var row_max_count = global.row_max_count;
} else {
	//e.g when testing 
	var log = require('bunyan').createLogger({
				'name': 'g6.Database.js', 'level': 'warn'
		});
	var row_max_count = 1000;
}



function Database(dbFile) 
{
	log.debug('ctor ' + dbFile);

	//destroy cached DBs with this name
	delete sqlite3.cached.objects[path.resolve(dbFile)];

	this.dbFile = dbFile;
	this.schema = null;
	
	this.tables = function() { return this.schema.tables; };

	this.linkedTableLists = [];	

	this.tableMap = function() { return this.tables; }
	this.tableLinkedLists = function() { return this.linkedTableLists; }
	
	var me = this;

	this.init = function(cbAfter) {
		var db = new sqlite3.Database( this.dbFile
							, sqlite3.OPEN_READWRITE
							, function(err) {
			if (err) {
				log.error("Database.init() failed. Could not open '" 
					+ me.dbFile + "'");
				cbAfter(err);
				return;
			}
			initTableDefs(err, db, function(err, tables) { 
				if (_.size(tables) == 0) {
					cbAfter(err);
					return;
				}
				initFieldDefs(err, db, tables, function(err, tables) {
					if (err) {
						cbAfter(err);
					} else {
						me.schema = new Schema(tables);
						me.schema.init(cbAfter);
					}
				});
			});
		});
	}

	function getStats(cbResult) {
		//add row counts
		var sql = _.map(_.keys(me.tables()), function(tn) {
			return 'SELECT ' + "'" + tn + "'" + ' AS table_name' 
					+ ', COUNT(*) AS count'
					+ ' FROM "' + tn + '"';
		});
		sql = sql.join(' UNION ALL ');
		//console.dir(sql);

		var result = {};
		if (_.size(me.tables()) == 0) {
			cbResult(null, result);
			return;
		}

		var db = new sqlite3.cached.Database(me.dbFile);
		db.all(sql, function(err, rows) {
			if (err) {
				log.warn("model.getStats() failed. " + err);	
				cbResult(err, null);
				return;
			}
			_.each(rows, function(r) {
				result[r.table_name] = r.count;
			});
			cbResult(null, result);
		});
	}

	this.getStats = function(cbResult) {
		getStats(cbResult);
	}	

	this.getSchemaAndStats = function(cbResult) {
		var result = getSchema();
		getStats(function(err, stats) {
			if ( ! err) {
				_.each(stats, function(c, tn) {
					result.tables[tn].count = c;
				});
			}
			cbResult(err, result);
		});
	}

	this.getSchema = function(cbResult) {
		var result = getSchema();
		cbResult(null, result);
	}

	function getSchema() {
		var result = me.schema.get();
		result.name = path.basename(me.dbFile, global.sqlite_ext);
		return result;
	}

	this.all = function(table, filterClauses, resultFields, order, limit, cbResult) {
		log.debug(resultFields + " from " + table.name 
				+ " filtered by " + util.inspect(filterClauses));
		try {
			var sql = this.schema.selectSQL(table, filterClauses, resultFields, order, limit);
		} catch(e) {
			var err = new Error("G6_MODEL_ERROR: model.all() failed. " + e);
			cbResult(err, []);
		}
		var db = new sqlite3.cached.Database(this.dbFile);

		db.all(sql.query, sql.params, function(err, rows) {
			if (err) {
				log.warn("model.all() failed. " + err);	
				cbResult(err, null);
			} else {
				//console.dir(rows);
				if (table.supertype) {
					_.each(rows, function(r) {
						r[table.supertype.name + "_sid"] = r.id;
					});
				}
				
				var countSql = sql.countSql 
					+ ' UNION ALL SELECT COUNT(id) as count FROM ' + table.name; 
				
				db.all(countSql, sql.params, function(err, countRows) {
					if (err) {
						cbResult(err, null);
					} else {
						var result = { 
							rows: rows, 
							count: countRows[0].count,
							totalCount: countRows[1].count
						}
						cbResult(null, result);
					}
				});
			}
		});
	}

	this.get = function(table, filterClauses, resultFields, cbResult) {
		try {
			var sql = this.schema.selectSQL(table, filterClauses, resultFields, [], 1);
		} catch(e) {
			var err = new Error("G6_MODEL_ERROR: model.get() failed. " + e);
			cbResult(err, []);
		}

		var db = new sqlite3.cached.Database(this.dbFile);

		db.get(sql.query, sql.params, function(err, row) {
			if (err) {
				log.warn("model.get() failed. " + err);	
			}

			if (row) {
				if (table.supertype) {
					row[table.supertype.name + "_sid"] = row.id;
				}
			}

			//console.dir(row);
			cbResult(err, row);
		});
	}

	this.count = function(table, filterClauses, cbResult) {
		try {
			var sql = buildCountSql(table, filterClauses);
		} catch(e) {
			var err = new Error("G6_MODEL_ERROR: model.count() failed. " + e);
			cbResult(err, []);
		}

		var db = new sqlite3.cached.Database(this.dbFile);

		db.all(sql.query, sql.params, function(err, rows) {
			if (err) {
				log.warn("model.get() failed. " + err);	
			}
			
			console.dir(rows);
			cbResult(err, rows);
		});
	}


	this.getDeep = function(table, filterClauses, resultFields, depth, cbResult) {
		
		if (resultFields != '*' &&  ! _.contains('id', resultFields)) {
			resultFields.push('id');
		}	

		var result = {};
	
		var tables = _.filter(me.tables(), function(t) {
			return isDescendant(t, table, depth);
		});

		//get top-level row	
		this.get(table, filterClauses, resultFields, 
					function(err, row) { 

			if (err) {
				cbResult(err, result);

			} else if (depth == 0) {
				result = row;
				cbResult(err, result);

			} else if (tables.length > 0 && !err && row) {
				result[table.name] = [row];

				var joinClause = {
					'table' : table.name,
					'field' : 'id',
					'operator'	: 'eq',
					'value' : row.id
				};

				var allDone = _.after(tables.length, function(err, result) {
					buildRowTree(table, result, depth);
					var obj = {};
					obj = result[table.name][0]; 
					cbResult(err, obj);
				});

				_.each(tables, function(t) {
					me.all(t, [joinClause], '*', [], row_max_count, function(err, res) {
						result[t.name] = res.rows;
						allDone(err, result);
					});
				});
			}

		});

	}

	function buildRowTree(rootTable, tableRows, depth) {

		_.each(tableRows, function(rows, tn) {
			if (tn != rootTable.name) {
				var fks = _.filter(me.tables()[tn].fields, function(f) { 
					return f.fk > 0; 
				});
				_.each(rows, function(row) {
	//console.log(row);
					_.each(fks, function(f) {
						var parentRow = _.find(tableRows[f.fk_table], 
							function(pr) {
								return pr.id == row[f.name];
							});	

						if (parentRow) {				
							//if fk is another branch, there is no parent loaded
							if (f.name == 'id') {
								//supertype
								parentRow[tn] = row;	
							} else {
								parentRow[tn] = parentRow[tn] || [];
								parentRow[tn].push(row);
							}	
						}
					});
				});
			}
		});
	}	


	this.insert = function(table, rows, cbDone) {

		if (rows.length == 0) {
			cbDone(null, []);
			return;
		}

		var fieldNames = _.filter(_.keys(rows[0]) 
							, function(fn) { 
				//filter out id and any non-field key
				return _.has(table.fields, fn) && fn != 'id'; 
		});


		if (table.supertype) {
			//exception do insert with id = supertype.id when rows are a subtype
			fieldNames.push('id');
			_.each(rows, function(r) {
				r.id = r[table.supertype.name + "_sid"];
			});
		}

		var fieldParams = _.times(fieldNames.length, function(fn) { return "?"; });

		var sql = "INSERT INTO " + table.name 
				+ '("' + fieldNames.join('", "') + '")'
				+ " VALUES (" + fieldParams.join(', ') + ");"

		//console.log(sql);

		var err = null;
		var ids = [];
		var db = new sqlite3.Database(this.dbFile);
		
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
					log.warn("Database.insert() failed. Rollback. " + err);
					db.run("ROLLBACK TRANSACTION");
				}
				cbDone(err, ids); 
			});	

		});
		db.close();
	}

	this.update = function(table, rows, cbDone) {

		if (rows.length == 0) {
			cbDone(null, []);
			return;
		}

		var fieldNames = _.filter(_.keys(rows[0]) 
							, function(fn) { 
				return _.has(table.fields, fn) && fn != 'id'; 
		});

		if (table.supertype) {
			fieldNames.push('id');
			//update id according to <supertype>_sid
			_.each(rows, function(r) {
				r.id = r[table.supertype.name + "_sid"];
			});
		}

		var sql = "UPDATE " + table.name
				+ ' SET "' + fieldNames.join('" = ?, "') + '" = ?'
				+ " WHERE id = ?"; 
		//console.log(sql);

		var err = null;
		var modCount = 0;	
		var db = new sqlite3.Database(this.dbFile);

		db.serialize(function() {
			db.run("PRAGMA foreign_keys = ON;");
			db.run("BEGIN TRANSACTION");

			var stmt = db.prepare(sql, function(e) {
				err = err || e;
			});

			_.each(rows, function(r) {

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
					log.warn("Database.update() failed. Rollback. " + err);
					db.run("ROLLBACK TRANSACTION");
				}
				cbDone(err, modCount); 
			});	

		});
		db.close();
	}

	this.delete = function(table, rows, cbDone) {

		if (rows.length == 0) {
			cbDone(null, []);
			return;
		}

		var idParams = _.times(rows.length, function(fn) { return "?"; });

		var sql = "DELETE FROM " + table['name'] 
				+ " WHERE id IN (" + idParams.join(', ') + ")";
		//console.log(sql);

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
				stmt.run(rows, function(e) { 
					err = err || e;
					delCount = this.changes;
				});
			}

			stmt.finalize(function() { 
				if (err == null && delCount != rows.length) {
					//console.log(delCount + " <> " + rows.length);
					err = new Error("G6_MODEL_ERROR: delete row count mismatch");
				}

				if (err == null) {
					db.run("COMMIT TRANSACTION");
				} else {
					log.warn("Database.delete() failed. Rollback. " + err);
					db.run("ROLLBACK TRANSACTION");
				}
				cbDone(err, delCount); 
			});	

		});
		db.close();
	}

	function initTableDefs(err, db, cbAfter) {
		if (err == null) {
			//get table and field attributes from table _defs_
			db.all("SELECT name, row_name, custom FROM _tabledef_ WHERE name IN (SELECT name FROM sqlite_master WHERE type = 'table')"
				, function(err ,rows) {
					if (err) { 
						log.error("Get table defs failed. " + err);

					} else {
					//console.log(rows);

						var tables = _.map(rows, function(r) {
							var tableDef = { 
								  "name": r['name'],
							};
							if (r['row_name'].length > 0) {
								tableDef['row_name'] = JSON.parse(r['row_name']);	
							}
							if (r['custom']) {
								tableDef = _.extend(tableDef, JSON.parse(r['custom']))
							}
							return tableDef;
						});	
						tables = _.object(_.pluck(tables, 'name'), tables);
					}
					cbAfter(err, tables);
			});			
		} else {
			cbAfter(err);
		}
	}

	function initFieldDefs(err, db, tables, cbAfter) {
		log.debug("initFieldDefs " + me.dbFile);
		if (err) {
			cbAfter(err);

		} else {
			db.all("SELECT name, table_name, ordering, domain FROM _fielddef_ WHERE table_name IN (SELECT name FROM sqlite_master WHERE type = 'table')"
				, function(err ,rows) {
					if (err) { 
						log.error("Get field defs failed. " + err);
						cbAfter(err);

					} else {
						//console.log(rows);

						var tableNames = _.uniq(_.pluck(rows, 'table_name'));

						_.each(tableNames, function(tn) {
							tables[tn]['fields'] = {};
						});

						_.each(rows, function(r) {
							var fieldDef = {
							  'order' : r['ordering'],
							  'row_name' : r['row_name'],
							  'fk' : 0	
							};
							if (r['domain']) {
								fieldDef['domain'] = JSON.parse(r['domain']);	
							}
							if (r['custom']) {
								fieldDef = _.extend(fieldDef, JSON.parse(r['custom']))
							}
							tables[r['table_name']]['fields'][r['name']] = fieldDef;
						});
						//console.dir(me.tables);

						var doAfter = _.after(2*tableNames.length, function() {
							//after executing two SQL statements per table
							cbAfter(null, tables);
						});

						_.each(tableNames, function(tn) {
							var sql = util.format("PRAGMA table_info(%s)", tn);
							//console.log(sql);
							db.all(sql, function(err, rows) {
								if (err) {
									log.error(sql + ' failed.');
									cbAfter(err, tables);
									return;

								} else {
									_.each(rows, function(r) {
										//console.log(r);
										var fn = r['name'];
										var fieldDef = tables[tn]['fields'][fn];
										if (fieldDef) {
											fieldDef = _.extend(fieldDef, r);
											//console.log(fieldDef);
											 
										} else {
											var err = new Error("G6_MODEL_ERROR: "
														+ tn + '.' + fn + ' not found.');
											cbAfter(err, tables);
											return;	
										}
									});
									doAfter();
								}
							});
						});
						_.each(tableNames, function(tn) {
							var sql = util.format("PRAGMA foreign_key_list(%s)", tn);
							db.all(sql, function(err, rows) {
								if (err) {
									log.error(sql + ' failed.');
									cbAfter(err, tables);
									return;
								} else {
									_.each(rows, function(r) {
										//console.log(r);
										var fk = r['from'];
										var fieldDef = tables[tn]['fields'][fk];
										if (fieldDef) {
											fieldDef['fk'] = 1;
											fieldDef['fk_table'] = r['table'];
											fieldDef['fk_field'] = r['to'];
										} else {
											var err = new Error("G6_MODEL_ERROR: "
														+ tn + '.' + fn + ' not found.');
											cbAfter(err, tables);
											return;	
										}
									});
									doAfter();
								}
							});
						});
					}
			});
		}
	}

}




function isDescendant(table, parentTable, depth) {

	if (depth > 0) {

		if ( _.contains(parentTable.children, table)
		  || _.contains(parentTable.subtypes, table)) 
		{
			return true;
		}
		for(var i = 0;i < parentTable.children.length; ++i) {
			if (isDescendant(table, parentTable.children[i], depth - 1))
				return true;
		}
		for(var i = 0;i < parentTable.subtypes.length; ++i) {
			if (isDescendant(table, parentTable.subtypes[i], depth - 1))
				return true;
		}
	}
	
	return false;
}

exports.Database = Database;
exports.isDescendant = isDescendant;
