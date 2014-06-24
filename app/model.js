
//var sqlite3 = require('sqlite3');
var sqlite3 = require('sqlite3').verbose();
var dir = require('node-dir');
var _ = require('underscore');

var fs = require('fs');
var path = require('path');
var util = require('util');

var assert = require('assert');

if (global.log) {
	var log = global.log.child({'mod': 'g6.model.js'});
} else {
	//e.g when testing 
	var log = require('bunyan').createLogger({
				'name': 'g6.model.js', 'level': 'debug'
		});
}

function Model(dbFile) 
{
	this.dbFile = dbFile;
	this.tables = {};

	this.tableMap = function() { return this.tables; }
	
	var me = this;

	this.init = function(cbAfter) {
		var db = new sqlite3.Database( this.dbFile
							, sqlite3.OPEN_READWRITE
							, function(err) {
			if (err) {
				log.error("Model.init() failed. Could not open '" 
					+ me.dbFile + "'");
				cbAfter(err);
			} else {
				initTableDefs(db, err, function(err) { 
					initFieldDefs(db, err, function(err) {
						if (err == null) {
							buildTableTree(_.values(me.tables));
						}
						cbAfter(err);
					});
				});
			}
		});
	}


	this.defs = function(cbResult) {
		assert(_.isObject(this.tables)); 
		var tableDefs = _.map(this.tables, function(table) {
			//replace parent, subtypes table refs with table names
			var t = _.clone(table);
			if (t['parent']) t['parent'] = t['parent']['name'];
			if (t['supertype']) t['supertype'] = t['supertype']['name'];

			var subtypes = t.subtypes;
			if (t.subtypes && t.subtypes.length > 0) t.subtypes = [];
			else delete(t.subtypes);
			_.each(subtypes, function(ct) {
				t.subtypes.push(ct.name);
			});
			
			var children = t.children;
			if (t.children && t.children.length > 0) t.children = [];
			else delete(t.children);
			_.each(children, function(ct) {
				t.children.push(ct.name);
			});


			t["fields"] = _.clone(t["fields"]);

			if (t["supertype"]) {
				//describe virtual <supertype>_sid field

				var sid_order = t["fields"]["id"]["order"] + 1;

				var sid_order_taken = _.find(t["fields"], function(f) {
					return f["order"] == sid_order;
				});

				if (sid_order_taken) {
					//sid field place is taken, make space.
					_.each(t["fields"], function(f) {
						if (f["order"] >= sid_order) {
							f["order"] = f["order"] + 1;
						}
					});
				}

				var sid = t["supertype"] + "_sid";
				t["fields"][sid] = { 
					"order": sid_order,
					"name": sid,
					"type": "INTEGER",
					"notnull": 1,
					"pk": 0
				};
			}

			return t;
		});

		tableDefs = _.object(_.pluck(tableDefs, 'name'), tableDefs);

		//add row counts
		var sql = _.map(_.keys(this.tables), function(tn) {
			return 'SELECT ' + "'" + tn + "'" + ' AS table_name' 
					+ ', COUNT(*) AS count'
					+ ' FROM "' + tn + '"';
		});
		sql = sql.join(' UNION ALL ');
		//console.dir(sql);

		var db = new sqlite3.cached.Database(this.dbFile);
		db.all(sql, function(err, rows) {
			if (err) {
				log.warn("model.defs() failed. " + err);	
			}
			_.each(rows, function(r) {
				tableDefs[r.table_name].count = r.count;
			});
			
			cbResult(err, tableDefs);
		});
	}

	this.all = function(filterFields, filterAncestor, table, resultFields, cbResult) {
		log.debug(resultFields + " from " + table.name);
		log.debug("filtered by " + util.inspect(filterAncestor));
		var sql = buildSelectSql(filterFields, filterAncestor, table, resultFields);

		var db = new sqlite3.cached.Database(this.dbFile);

		db.all(sql['query'], sql['params'], function(err, rows) {
			if (err) {
				log.warn("model.all() failed. " + err);	
			}
			//console.dir(rows);
			if (table["supertype"]) {
				_.each(rows, function(r) {
					r[table["supertype"]["name"] + "_sid"] = r['id'];
				});
			}
			//handle mutlichoice json array
			var mcFields = _.filter(table["fields"], function(f) {
				return f["domain"] && f["domain"]["multichoice"];
			});
			_.each(mcFields, function(f) {
				_.each(rows, function(r) {
					r[f.name] = JSON.parse(r[f.name]);
				});
			});
			cbResult(err, rows);
		});
		
	}

	this.get = function(filterFields, filterAncestor, table, resultFields, cbResult) {
		var sql = buildSelectSql(filterFields, filterAncestor, table, resultFields);

		var db = new sqlite3.cached.Database(this.dbFile);

		db.get(sql['query'], sql['params'], function(err, row) {
			if (err) {
				log.warn("model.get() failed. " + err);	
			}

			if (table["supertype"]) {
				row[table["supertype"]["name"] + "_sid"] = row['id'];
			}
			//handle mutlichoice json array
			var mcFields = _.filter(table["fields"], function(f) {
				return f["domain"] && f["domain"]["multichoice"];
			});
			_.each(mcFields, function(f) {
				row[f.name] = JSON.parse(row[f.name]);
			});

			//console.dir(row);
			cbResult(err, row);
		});
	}

	this.getDeep = function(depth, filterFields, table, resultFields, cbResult) {
		
		if (resultFields != '*' &&  ! _.contains('id', resultFields)) {
			resultFields.push('id');
		}	

		var result = {};
	
		var tables = _.filter(me.tables, function(t) {
			return isDescendant(t, table, depth);
		});

		//get top-level row	
		this.get(filterFields, {}, table, resultFields, 
					function(err, row) { 

			result[table.name] = [row];

			if (tables.length > 0 && !err) {

				var filterAncestor = {};
				filterAncestor[table.name] = row.id;

				var allDone = _.after(tables.length, function(err, result) {
					buildRowTree(table, result);
					var obj = {};
					obj[table.name] = result[table.name][0]; 
					cbResult(err, obj);
				});

				_.each(tables, function(t) {
					me.all({}, filterAncestor, t, '*', function(err, rows) {
						result[t.name] = rows;
						allDone(err, result);
					});
				});
			} else {
				cbResult(err, result);
			}

		});

	}

	function buildRowTree(rootTable, rowsTables) {
		_.each(rowsTables, function(rows, tn) {
			var into, fld; 
			if (me.tables[tn].parent) {
				into = me.tables[tn].parent.name;
				fld = "_pid";
			} else if (me.tables[tn].supertype) {
				into = me.tables[tn].supertype.name;
				fld = "_sid";
			}
			//console.log(tn + " -> " + into + fld);
			if (into && rootTable.name != tn) {				
				_.each(rows, function(row) {
					var parentRow = _.find(rowsTables[into], function(pr) {
						return pr.id == row[into + fld];
					});					
					//console.log(row + " parent " + util.inspect(parentRow));					
					if (me.tables[tn].parent) {
						parentRow[tn] = parentRow[tn] || [];
						parentRow[tn].push(row);
					} else if (me.tables[tn].supertype) {
						parentRow[tn] = row;
					}
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
				return _.has(table['fields'], fn) && fn != 'id'; 
		});

		if (table["supertype"]) {
			//exception do insert with id = supertype.id when rows are a subtype
			fieldNames.push('id');
			_.each(rows, function(r) {
				r['id'] = r[table["supertype"]["name"] + "_sid"];
			});
		}

		var fieldParams = _.times(fieldNames.length, function(fn) { return "?"; });

		var sql = "INSERT INTO " + table['name'] 
				+ '("' + fieldNames.join('", "') + '")'
				+ " VALUES (" + fieldParams.join(', ') + ")";
		//console.log(sql);

		var err = null;
		var ids = [];
		var db = new sqlite3.Database(this.dbFile);
		
		db.serialize(function() {
			db.run("PRAGMA foreign_keys = ON;");
			db.run("BEGIN TRANSACTION");

			var stmt = db.prepare(sql, function(e) {
				err = e;
			});

			_.each(rows, function(r) {
				if (err == null) {					
					var params = _.map(fieldNames, function(fn) { return r[fn]; });
					//console.log(params);
					stmt.run(params, function(e) { 
						if (e) err = e;
						ids.push(this.lastID);
					});
				}
			});

			stmt.finalize(function() { 
				if (err == null) {
					db.run("COMMIT TRANSACTION");
				} else {
					log.warn("Model.insert() failed. Rollback. " + err);
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
				return _.has(table['fields'], fn) && fn != 'id'; 
		});

		if (table["supertype"]) {
			fieldNames.push('id');
			//update id according to <supertype>_sid
			_.each(rows, function(r) {
				r['id'] = r[table["supertype"]["name"] + "_sid"];
			});
		}


		var sql = "UPDATE " + table['name'] 
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
				err = e;
			});

			_.each(rows, function(r) {

				if (err == null) {					
					var params = _.map(fieldNames, function(fn) { return r[fn]; });
					params.push(r['id']);
					//console.log(params);

					stmt.run(params, function(e) {
						if (e) err = e;
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
					log.warn("Model.update() failed. Rollback. " + err);
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
				err = e;
			});

			if (err == null) 
			{
				stmt.run(rows, function(e) { 
					err = e;
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
					log.warn("Model.delete() failed. Rollback. " + err);
					db.run("ROLLBACK TRANSACTION");
				}
				cbDone(err, delCount); 
			});	

		});
		db.close();
	}


	function initTableDefs(db, err, cbAfter) {
		if (err == null) {
			//get table and field attributes from table _defs_
			db.all("SELECT name, parent, custom FROM _tabledef_ WHERE name IN (SELECT name FROM sqlite_master WHERE type = 'table')"
				, function(err ,rows) {
					if (err) { 
						log.error("Get table defs failed. " + err);

					} else {
					//console.log(rows);

						var tables = _.map(rows, function(r) {
							var tableDef = { 
								  "name": r['name']
								, "parent": r['parent'] 
							};
							if (r['custom']) {
								tableDef = _.extend(tableDef, JSON.parse(r['custom']))
							}
							return tableDef;
						});	
						me.tables = _.object(_.pluck(tables, 'name'), tables);
					}
					cbAfter(err);
			});			
		} else {
			cbAfter(err);
		}
	}

	function initFieldDefs(db, err, cbAfter) {
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
							me.tables[tn]['fields'] = {};
						});

						_.each(rows, function(r) {
							var fieldDef = {
							  'order' : r['ordering']					
							};
							if (r['domain']) {
								fieldDef['domain'] = JSON.parse(r['domain']);	
							}
							if (r['custom']) {
								fieldDef = _.extend(fieldDef, JSON.parse(r['custom']))
							}
							me.tables[r['table_name']]['fields'][r['name']] = fieldDef;
						});
						//console.dir(me.tables);

						var doAfter = _.after(tableNames.length, function() {
							cbAfter();
						});

						_.each(tableNames, function(tn) {
							var sql = util.format("PRAGMA table_info(%s)", tn);
							//console.log(sql);
							db.all(sql, function(err, rows) {
								if (err) {
									log.error(sql + ' failed.');
									cbAfter(err);
									return;

								} else {
									_.each(rows, function(r) {
										//console.log(r);
										var fn = r['name'];
										var fieldDef = me.tables[tn]['fields'][fn];
										if ( ! fieldDef) {
											var err = new Error("G6_MODEL_ERROR: "
														+ tn + '.' + fn + ' not found.');
											cbAfter(err);
											return;	
											 
										} else {
											fieldDef = _.extend(fieldDef, r);
											//console.log(fieldDef);
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

/*
 * buildTableTree constructs a description of tables in memory 
 *
 * input: tables array that describe each table as JSON
 * output: the same tables array is
 *		   modified having a doubly-linked tree structure
 *
 * a table can have one parent table
 *
 * the parent can have a one-to-many relationship 
 * between a parent row and the table's rows (parent-children)
 * in that case the table will have a FK to the parent
 * using a field named <parent>_pid 
 *
 * or the parent can be in a one-to-one relationship
 * between a parent row and a matching table row (supertype-subtype)
 * in that case the table will have a FK to the parent (supertype) 
 * on its own id field. That is, subtype and supertype rows share common ids.
 *
 * in memory we add "forward pointers" to the children as well
 *
 */
function buildTableTree(tables) {
	log.debug("Building table tree. Got " + tables.length + " tables.");

	_.each(tables, function(table) {

		var parentName = table['parent'];
		if (parentName != null) {

			if (_.contains(_.keys(table['fields']), parentName + "_pid")) {
				//parent-child relationship
				table['parent'] = _.find(tables, function(t) {
					return t['name'] == parentName;
				});

			} else {
				//supertype-subtype relationship
				table['supertype'] = _.find(tables, function(t) {
					return t['name'] == parentName;
				});
				delete(table['parent']);
			}
		}

	});

	_.each(tables, function(table) {

		table['children'] = _.filter(tables, function(t) {
			return t['parent'] && t['parent']['name'] == table['name'];
		});

		table['subtypes'] = _.filter(tables, function(t) {
			return t['supertype'] && t['supertype']['name'] == table['name'];
		});
	});
	return tables;
}

function buildSelectSql(filterFields, filterAncestor, table, fields) {

	assert(_.isObject(filterFields), "arg 'filterFields' is object");
	assert(_.isObject(filterAncestor), "arg 'filterAncestor' is object");
	assert(_.isObject(table), "arg 'table' is object");

	if (fields == '*') {
		fields = _.map(table['fields'], function(f) {
			return util.format('%s."%s"', table['name'], f['name']);
		});
	}

	assert(_.isArray(fields), "arg 'fields' is array");

	var sql = "SELECT " + fields.join(",") + " FROM " + table['name'];

	var joins = ""
	  , where = " WHERE 1=1"
	  , sql_params = [];

	if (_.keys(filterAncestor).length > 0) {
		var ancestorTable = _.keys(filterAncestor)[0];
		var ancestorId = filterAncestor[ancestorTable];
		var hasAncestor = false;

		var t = table;
		while(t['parent'] || t['supertype']) {
			var pt;

			if (t['parent']) {
				pt = t['parent'];
				var pid_name = pt['name'] + "_pid";
				joins = joins + util.format(" INNER JOIN %s ON %s.%s = %s.id", 
											pt['name'], t['name'], 
											pid_name, pt['name']);

			} else if (t['supertype']) {
				pt = t['supertype'];
				joins = joins + util.format(" INNER JOIN %s ON %s.id = %s.id", 
											pt['name'], t['name'], pt['name']);

			}
	
			if (pt['name'] == ancestorTable) {
				where = where + " AND " + ancestorTable + ".id = ?";
				sql_params.push(ancestorId);
				hasAncestor = true;
				break;
			}
		
			//console.log(joins, where);
			t = pt;
		}
		if ( ! hasAncestor) {
			//no ancestor found - don't join tables
			joins = "";
		}
	}

	_.each(filterFields, function(v,k) {
		where = where + ' AND ' + k + ' = ?';
		sql_params.push(v);	
	});

	sql = sql + joins + where;
	//console.log(sql, sql_params);
	return {'query': sql, 'params': sql_params};
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


exports.Model = Model;
exports.isDescendant = isDescendant;
