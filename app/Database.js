
//var sqlite3 = require('sqlite3');
var sqlite3 = require('sqlite3').verbose();
var dir = require('node-dir');
var _ = require('underscore');

var fs = require('fs');
var path = require('path');
var util = require('util');


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

	//this.tableMap = function() { return this.tables; }
	this.tableLinkedLists = function() { return this.linkedTableLists; }
	
	var me = this;

	this.init = function(cbAfter) {

		me.schema = new Schema();
		me.schema.read(this.dbFile, cbAfter);
	}

	this.getSchema = function(cbResult) {
		var result = me.schema.get();
		result.name = path.basename(me.dbFile, global.sqlite_ext);
		cbResult(null, result);
	}


	this.getCounts = function(cbResult) {
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

	this.getStats = function(table, filterClauses, resultFields, cbResult) {

		var filterSQL = this.schema.filterSQL(table, filterClauses);

		if (resultFields == '*') {
			resultFields = table.viewFields();
		} else {
			this.schema.checkFields(resultFields);
		}

		var useView = true;
		var tableName = useView ? table.viewName() : table.name;

		var sql_query = _.reduce(resultFields, function(memo, f) {

			var s = util.format("SELECT '%s' as field, "
						+ "min(%s.%s) as min, max(%s.%s) as max "
						+ " FROM %s", 
							f, 
							tableName, f, 
							tableName, f, 
							tableName);

			s += filterSQL.join + filterSQL.where;

			return (memo.length == 0) ?  s : memo + ' UNION ALL ' + s;
		}, '');

		var sql_params = [];
		_.each(resultFields, function() {
			sql_params = sql_params.concat(filterSQL.params);
		});

		log.debug(sql_query);
		log.debug(sql_params);
		var db = new sqlite3.cached.Database(this.dbFile);
		db.all(sql_query, sql_params, function(err, rows) {
			if (err) {
				log.warn("model.getStats() failed. " + err);	
				cbResult(err, null);
				return;
			}
			var result = {};
			_.each(rows, function(r) {
				result[r.field] = { 
					field: r.field,
					min: r.min,
					max: r.max,
					distinct: r.count
				};
			});
			cbResult(null, result);
		});
	}	


	this.all = function(table, filterClauses, resultFields, order, limit, offset, distinct, cbResult) {
		log.debug(resultFields + " from " + table.name 
				+ " filtered by " + util.inspect(filterClauses));
		try {
			var sql = this.schema.selectSQL(table, filterClauses, resultFields, order, limit, offset, distinct);
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
				
				var countSql = sql.countSql 
					+ ' UNION ALL SELECT COUNT(*) as count FROM ' + table.name; 
				
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
			var sql = this.schema.selectSQL(table, filterClauses, resultFields, [], 1, 0, false);
		} catch(e) {
			var err = new Error("G6_MODEL_ERROR: model.get() failed. " + e);
			cbResult(err, []);
		}

		var db = new sqlite3.cached.Database(this.dbFile);

		db.get(sql.query, sql.params, function(err, row) {
			if (err) {
				log.warn("model.get() failed. " + err);	
			}

			//console.dir(row);
			cbResult(err, row);
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

			log.debug('get err "' + err + '" row "' + row + '"'); 
			
			if (err) {
				cbResult(err, null);

			} else if (! row) {
				cbResult(null, result);

			} else if (depth == 0 || tables.length == 0) {
				result = row;
				cbResult(err, result);

			} else /* (tables.length > 0 && !err && row) */ {
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
					me.all(t, [joinClause], '*', [], row_max_count, 0, false, function(err, res) {
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
							parentRow[tn] = parentRow[tn] || [];
							parentRow[tn].push(row);
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
				//filter out any non-field key
				return _.has(table.fields, fn); // && fn != 'id'; 
		});

		var fieldParams = _.times(fieldNames.length
						, function(fn) { return "?"; });

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

}




function isDescendant(table, parentTable, depth) {

	if (depth > 0) {

		if ( _.contains(parentTable.children, table)) 
		{
			return true;
		}
		for(var i = 0;i < parentTable.children.length; ++i) {
			if (isDescendant(table, parentTable.children[i], depth - 1))
				return true;
		}
	}
	
	return false;
}

exports.Database = Database;
exports.isDescendant = isDescendant;
