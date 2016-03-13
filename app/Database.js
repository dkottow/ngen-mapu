
//var sqlite3 = require('sqlite3');
var sqlite3 = require('sqlite3').verbose();
var dir = require('node-dir');
var _ = require('underscore');

var fs = require('fs');
var path = require('path');
var util = require('util');


var Schema = require('./Schema.js').Schema;

global.log = global.log || require('bunyan').createLogger({
	name: 'g6.server',
	level: 'debug',
	src: true,
	stream: process.stderr
});
global.row_max_count = global.row_count || 1000;


function Database(dbFile) 
{
	log.debug('ctor ' + dbFile);

	//destroy cached DBs with this name
	delete sqlite3.cached.objects[path.resolve(dbFile)];

	this.dbFile = dbFile;
	this.schema = null;
	
	var me = this;

	this.tables = function() { return this.schema.tables; };

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
			db.close(function() {
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
		});
	}

	this.getStats = function(tableName, options, cbResult) {

		try {

			var table = this.tables()[tableName];
			if (! cbResult) {
				cbResult = options;
				options = {};
			}
			options = options || {};		

			var filterClauses = options.filter || [];
			var resultFields = options.fields || '*'; 

			var filterSQL = this.schema.filterSQL(table, filterClauses);

			if (resultFields == '*') {
				resultFields = table.viewFields();
			} else {
				this.schema.checkFields(resultFields);
			}

			var useView = true;
			var tName = useView ? table.viewName() : table.name;

			var sql_query = _.reduce(resultFields, function(memo, f) {

				var s = util.format("SELECT '%s' as field, "
							+ "min(%s.%s) as min, max(%s.%s) as max "
							+ " FROM %s", 
								f, 
								tName, f, 
								tName, f, 
								tName);

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
				db.close(function() {
					if (err) {
						log.warn("db.all() failed. " + err);	
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
			});

		} catch(err) {
			log.warn("model.getStats() failed. " + err);	
			cbResult(err, null);
		}
	}	

	this.all = function(tableName, options, cbResult) {

		try {

			var table = this.tables()[tableName];
			if (! cbResult) {
				cbResult = options;
				options = {};
			}
			options = options || {};		

			var filterClauses = options.filter || [];
			var resultFields = options.fields || '*'; 
			var order = options.order || [];
			var limit = options.limit || global.row_max_count;
			var offset = options.offset || 0;
			var distinct = options.distinct || false;

			log.debug(resultFields + " from " + table.name 
					+ " filtered by " + util.inspect(filterClauses));

			var sql = this.schema.selectSQL(table, filterClauses, resultFields, order, limit, offset, distinct);

			var db = new sqlite3.Database(this.dbFile);

			db.all(sql.query, sql.params, function(err, rows) {
				if (err) {
					log.warn("model.all() failed. " + err);	
					db.close();
					cbResult(err, null);
				} else {
					//console.dir(rows);
					
					var countSql = sql.countSql 
						+ ' UNION ALL SELECT COUNT(*) as count FROM ' + table.name; 
					
					db.all(countSql, sql.params, function(err, countRows) {
						db.close(function() {
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
					});
				}
			});

		} catch(err) {
			log.warn("model.all() failed. " + err);	
			cbResult(err, []);
		}
	}

	this.get = function(tableName, options, cbResult) {

		try {

			var table = this.tables()[tableName];
			if (! cbResult) {
				cbResult = options;
				options = {};
			}
			options = options || {};		

			var filterClauses = options.filter || [];
			var resultFields = options.fields || '*'; 

			var sql = this.schema.selectSQL(table, filterClauses, resultFields, [], 1, 0, false);

			var db = new sqlite3.Database(this.dbFile);

			db.get(sql.query, sql.params, function(err, row) {
				db.close(function() {
					if (err) {
						log.warn("model.get() failed. " + err);	
					}
					//console.dir(row);
					cbResult(err, row);
				});
			});

		} catch(err) {
			log.warn("model.get() failed. " + err);	
			cbResult(err, []);
		}
	}

	//TODO we should join all table, not only children
	this.getDeep = function(tableName, options, cbResult) {
		
		try {

			var table = this.tables()[tableName];
			if (! cbResult) {
				cbResult = options;
				options = {};
			}
			options = options || {};		

			var depth = options.depth || 3;

/* TODO
			if (resultFields != '*' &&  ! _.contains('id', resultFields)) {
				resultFields.push('id');
			}	
*/

			var result = {};
		
			var tables = _.filter(me.tables(), function(t) {
				return isDescendant(t, table, depth);
			});

			//get top-level row	
			this.get(tableName, options, function(err, row) { 

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
						me.all(t.name, { filter: [joinClause] }, 
							function(err, res) {
								result[t.name] = res.rows;
								allDone(err, result);
						});
					});
				}

			});

		} catch(err) {
			log.warn("model.getDeep() failed. " + err);	
			cbResult(err, {});
		}
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


	this.insert = function(tableName, rows, cbResult) {

		try {

			var table = this.tables()[tableName];

			if (rows.length == 0) {
				cbResult(null, []);
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
					db.close();
					cbResult(err, ids); 
				});	

			});

		} catch(err) {
			log.warn("model.insert() failed. " + err);	
			cbResult(err, []);
		}
	}

	this.update = function(tableName, rows, cbResult) {

		try {

			var table = this.tables()[tableName];

			if (rows.length == 0) {
				cbResult(null, []);
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
					db.close();
					cbResult(err, modCount); 
				});	

			});

		} catch(err) {
			log.warn("model.update() failed. " + err);	
			cbResult(err, 0);
		}
	}

	this.delete = function(tableName, rows, cbResult) {

		try {

			var table = this.tables()[tableName];

			if (rows.length == 0) {
				cbResult(null, []);
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
					db.close();
					cbResult(err, delCount); 
				});	

			});

		} catch(err) {
			log.warn("model.delete() failed. " + err);	
			cbResult(err, 0);
		}
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
