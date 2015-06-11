
//var sqlite3 = require('sqlite3');
var sqlite3 = require('sqlite3').verbose();
var dir = require('node-dir');
var _ = require('underscore');

var fs = require('fs');
var path = require('path');
var util = require('util');

var assert = require('assert');

var schema = require('./schema.js');

if (global.log) {
	var log = global.log.child({'mod': 'g6.model.js'});
	var row_max_count = global.row_max_count;
} else {
	//e.g when testing 
	var log = require('bunyan').createLogger({
				'name': 'g6.model.js', 'level': 'debug'
		});
	var row_max_count = 1000;
}



function Model(dbFile) 
{
	this.dbFile = dbFile;
	this.tables = {};
	this.linkedTableLists = [];	

	this.tableMap = function() { return this.tables; }
	this.tableLinkedLists = function() { return this.linkedTableLists; }
	
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
							buildTableGraph(_.values(me.tables));
						}
						cbAfter(err);
					});
				});
			}
		});
	}

	this.getSchemaAndStats = function(cbResult) {
		var result = getSchema();
		
		//add row counts
		var sql = _.map(_.keys(me.tables), function(tn) {
			return 'SELECT ' + "'" + tn + "'" + ' AS table_name' 
					+ ', COUNT(*) AS count'
					+ ' FROM "' + tn + '"';
		});
		sql = sql.join(' UNION ALL ');
		//console.dir(sql);

		var db = new sqlite3.cached.Database(me.dbFile);
		db.all(sql, function(err, rows) {
			if (err) {
				log.warn("model.getSchema() failed. " + err);	
			}
			_.each(rows, function(r) {
				result.tables[r.table_name].count = r.count;
			});
			
			cbResult(err, result);
		});
	}
	this.getSchema = function(cbResult) {
		var result = getSchema();
		cbResult(null, result);
	}

	function getSchema() {
		assert(_.isObject(me.tables)); 
		var tableDefs = _.map(me.tables, function(table) {
			//replace parent, subtypes table refs with table names
			var t = _.clone(table);
			if (t.supertype) t.supertype = t.supertype.name;

			var parents = t.parents;
			if (t.parents && t.parents.length > 0) t.parents = [];
			else delete(t.parents);
			_.each(parents, function(ct) {
				t.parents.push(ct.name);
			});

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
					"pk": 0,
					"fk": 1,
					"fk_table": t["supertype"],
					"fk_field": "id",
					"row_name": 0
				};

				//mark id field as non-fk
				t.fields.id.fk = 0;
			}

			return t;
		});

		tableDefs = _.object(_.pluck(tableDefs, 'name'), tableDefs);
		return {
			'name': path.basename(me.dbFile, global.sqlite_ext), 
			'tables': tableDefs,
			'joins': me.linkedTableLists
		};		
	}

	this.setSchema = function(tableDefs, cbResult) {
		//TODO check its empty?
		fs.unlink(me.dbFile, function(err) {
			if ( ! err) {
				me.createSchema(tableDefs, cbResult);
			} else {
				log.warn("setSchema() failed. " + err);
				cbResult(err);
			}
		});
	}

	this.createSchema = function(tableDefs, cbResult) {
		var dbDef = new schema.Database(tableDefs);
		dbDef.init(function(err) {
			if ( ! err) {
				var sql = dbDef.createSQL();	
				console.log(sql);
				var db = new sqlite3.Database(":memory:");
				db.exec(sql, function(err) {
					db.close();
					if ( ! err) {
						//really create DB on file
						log.info("creating " + me.dbFile);
						db = new sqlite3.Database(me.dbFile 
								, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE
								, function(err) {

							db.exec(sql, function(err) {
								db.close();
								cbResult(err);
							});
						});
					} else {
						log.warn("createSchema() failed. " + err);
						cbResult(err);
					}
				});
			} else {
				log.warn("createSchema() failed. " + err);
				cbResult(err);
			} 
		});
	}

	this.all = function(table, filterClauses, resultFields, order, limit, cbResult) {
		log.debug(resultFields + " from " + table.name 
				+ "filtered by " + util.inspect(filterClauses));
		try {
			var sql = buildSelectSql(table, filterClauses, resultFields, order, limit);
		} catch(e) {
			err = new Error("G6_MODEL_ERROR: model.all() failed. " + e);
			cbResult(err, []);
		}
		var db = new sqlite3.cached.Database(this.dbFile);

		db.all(sql['query'], sql['params'], function(err, rows) {
			if (err) {
				log.warn("model.all() failed. " + err);	
			} else {
				//console.dir(rows);
				if (table["supertype"]) {
					_.each(rows, function(r) {
						r[table["supertype"]["name"] + "_sid"] = r['id'];
					});
				}
			}
			cbResult(err, rows);
		});
	}

	this.get = function(table, filterClauses, resultFields, cbResult) {
		try {
			var sql = buildSelectSql(table, filterClauses, resultFields, [], 1);
		} catch(e) {
			err = new Error("G6_MODEL_ERROR: model.get() failed. " + e);
			cbResult(err, []);
		}

		var db = new sqlite3.cached.Database(this.dbFile);

		db.get(sql['query'], sql['params'], function(err, row) {
			if (err) {
				log.warn("model.get() failed. " + err);	
			}

			if (row) {
				if (table["supertype"]) {
					row[table["supertype"]["name"] + "_sid"] = row['id'];
				}
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
	
		var tables = _.filter(me.tables, function(t) {
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
					me.all(t, [joinClause], '*', [], row_max_count, function(err, rows) {
						result[t.name] = rows;
						allDone(err, result);
					});
				});
			}

		});

	}

	function buildRowTree(rootTable, tableRows, depth) {

		_.each(tableRows, function(rows, tn) {
			if (tn != rootTable.name) {
				var fks = _.filter(me.tables[tn].fields, function(f) { 
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
							me.tables[r['table_name']]['fields'][r['name']] = fieldDef;
						});
						//console.dir(me.tables);

						var doAfter = _.after(2*tableNames.length, function() {
							//after executing two SQL statements per table
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
										if (fieldDef) {
											fieldDef = _.extend(fieldDef, r);
											//console.log(fieldDef);
											 
										} else {
											var err = new Error("G6_MODEL_ERROR: "
														+ tn + '.' + fn + ' not found.');
											cbAfter(err);
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
									cbAfter(err);
									return;
								} else {
									_.each(rows, function(r) {
										//console.log(r);
										var fk = r['from'];
										var fieldDef = me.tables[tn]['fields'][fk];
										if (fieldDef) {
											fieldDef['fk'] = 1;
											fieldDef['fk_table'] = r['table'];
											fieldDef['fk_field'] = r['to'];
										} else {
											var err = new Error("G6_MODEL_ERROR: "
														+ tn + '.' + fn + ' not found.');
											cbAfter(err);
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
	 * in that case the table's own id field will be a FK to the parent (supertype) 
	 * That is, subtype and supertype rows share common ids.
	 *
	 * in memory we add "forward pointers" to the children / subtypes as well
	 *
	 */

	function buildTableGraph() {

		var tables = _.values(me.tables);

		log.debug("Building table graph. Got " + tables.length + " tables.");

		_.each(tables, function(table) {

			var fks = _.filter(table.fields, function(f) {
				return f.fk == 1 && f.name != 'id';
			});

			table.parents = _.filter(tables, function(t) {
				return _.contains(_.pluck(fks, 'fk_table'), t.name);
			});

			if (table.fields['id'].fk == 1) {
				table.supertype = _.find(tables, function(t) {
					return table.fields['id'].fk_table == t.name;
				});
				//unmark id as fk
				//table.fields['id'].fk = 0;
			}
			//log.debug(table);
		});
		_.each(tables, function(table) {

			table.children = _.filter(tables, function(t) {
				return _.contains(_.pluck(t.parents, 'name'), table.name);
			});

			table.subtypes = _.filter(tables, function(t) {
				return t.supertype && t.supertype.name == table.name;
			});
		});

		var linkedTables = [];
		_.each(tables, function(table) {
			
			var linked = false;
			_.each(linkedTables, function(list) {
				if (! linked) {
					var p = bfsPath(table, me.tables[list[0]], me.tables);
					if (p.length > 0) {
						list.push(table.name);
						linked = true;
					}
				}
			});	

			if (! linked) {
				linkedTables.push([table.name]);
			}		
		});
		//console.log(linkedTables);
		me.linkedTableLists = linkedTables;
	}



	function buildSelectSql(table, filterClauses, fields, order, limit) 
	{
		assert(_.isArray(filterClauses), "arg 'filterClauses' is array");
		assert(_.isObject(table), "arg 'table' is object");
		assert(_.isArray(order), "arg 'order' is array");

		if (fields == '*') {
			fields = _.map(table.fields, function(f) {
				return util.format('%s."%s"', table.name, f.name);
			});
		}		

		assert(_.isArray(fields), "arg 'fields' is array");
		
		if (_.isNumber(limit)) limit = limit.toString();
		assert(_.isString(limit), "arg 'limit' is string");

		var joinTables = {};
		var joinSQL = "";

		var nkValue = _.reduce(table.row_name, function(memo, nk) {
			var result;
			
			if (nk.indexOf('.') < 0) {
				result = util.format('%s."%s"', table.name, nk);
			} else {
				var nkTable = nk.split('.')[0]; 	
				var nkField = nk.split('.')[1]; 	
				result = util.format('%s."%s"', nkTable, nkField);

				var path = bfsPath(table, me.tables[nkTable], me.tables);
				var j = joinTablePath(path, joinTables);
				joinSQL = joinSQL + j.sql;
				for(var i = 1; i < path.length; ++i) {
					joinTables[path[i].name] = path[i];
				}
			}	
			if ( ! _.isEmpty(memo)) {
				result = memo + " || ' ' || " + result;
			}
			return result;
		}, '');

		var fieldSQL = fields.join(",");
		if (! _.isEmpty(nkValue)) {
			fieldSQL = fieldSQL + ", " + nkValue + " AS row_name";
		}
		

		var whereSQL = " WHERE 1=1";
		var distinct = false;
		var sql_params = [];

		_.each(filterClauses, function(filter) {

			if ( ! filter.table) {
				filter.table = table.name;
			}

			assert(_.contains(_.pluck(
					me.tables[filter.table].fields, 'name'), 
						filter.field), 
				util.format("filter field %s.%s unknown", 
					filter.table, filter.field));

			if (filter.table != table.name) {

				var path = bfsPath(table, me.tables[filter.table], me.tables);
				var j = joinTablePath(path, joinTables);
				joinSQL = joinSQL + j.sql;
				distinct = distinct || j.distinct;
				for(var i = 1; i < path.length; ++i) {
					joinTables[path[i].name] = path[i];
				}
			}

			if (filter.operator && filter.value) {

				var scalarClauses = {'eq' : '=', 
									 'ge': '>=', 
									 'gt': '>', 
									 'le': '<=', 
									 'lt': '<'  };
				
				//TODO - IN operator?

				assert(_.has(scalarClauses, filter.operator),
					util.format("filter clause %s unknown",  
						filter.operator));

				whereSQL = whereSQL + util.format(" AND %s.%s %s ?", 
						filter.table, filter.field, 
						scalarClauses[filter.operator]);
					
				sql_params.push(filter.value);
			}
		});

		var orderSQL;
		if ( ! _.isEmpty(order)) {	
			var orderField = order[0];
			var orderDir = 'ASC';
			if (order.length > 1 && order[1].toLowerCase() == 'desc') {
				orderDir = 'DESC';
			}

			assert(_.contains(_.pluck(table['fields'], 'name'), orderField),
				  util.format("order field '%s' unknown", orderField));

			orderSQL = util.format(' ORDER BY %s."%s" %s', 
							table['name'], orderField, orderDir);
		} else {
			//most recently modified first
			orderSQL = " ORDER BY " + table['name'] + ".id DESC";
		}


		var limitSQL = " LIMIT " + row_max_count;
		if (limit.indexOf(',') > 0) {
			var ab = limit.split(",");
			var a = parseInt(ab[0]);
			var b = parseInt(ab[1]);
			if ( !_.isNaN(a) && !_.isNaN(b)) {
				limitSQL = util.format(" LIMIT %d, %d", a, b);
			}
		} else {
			var a = parseInt(limit);
			if (!_.isNaN(a)) {
				limitSQL = util.format(" LIMIT %d", a);
			}
		}

		var sql = "SELECT ";
		if (distinct) sql = sql + "DISTINCT ";
		sql = sql + fieldSQL + " FROM " + table.name 
				+ " " + joinSQL + whereSQL + orderSQL + limitSQL;

		console.log(sql, sql_params);
		return {'query': sql, 'params': sql_params};
	}


}

function linkedTables(table)
{
	var links = [];
	links = table.parents;
	links = links.concat(table.children);
	links = links.concat(table.subtypes);
	if (table.supertype) links.push(table.supertype);
	return links;
}

function bfsPath(table, joinTable, tables)
{
	//console.log(table.name);
	//console.log(joinTable.name);
	var visited = {};
	var queue = [];
	queue.push([table]);
	visited[table.name] = true;
	while ( ! _.isEmpty(queue)) {
		var path = queue.shift();
		var t = _.last(path);
		if (t == joinTable) {
			return path;
		}		

		var links = linkedTables(t);

		_.each(links, function(lt) {
			if (! visited[lt.name]) {
				visited[lt.name] = true;
				var np = path.slice(0); //copy path
				np.push(lt);
				queue.push(np);
			}
		});
	}
	return []; //not found
}

function joinTablePath(tables, exclude)
{
	var joinClause = "";
	var distinct = false;
	for(var i = 0;i < tables.length - 1; ++i) {
		var t = tables[i];
		var pt = tables[i+1];

		if (exclude[pt.name]) continue; 

		//this finds supertypes as well
		var fk = _.find(t.fields, function(f) {
			return f.fk_table == pt.name;
		});

		if (fk) {
			// pt is parent or supertype			
			joinClause = joinClause 
				  + util.format(" INNER JOIN %s ON %s.%s = %s.id", 
								pt['name'], 
								t['name'], fk.name, 
								pt['name']);

		} else {
			// pt is child or subtype			
			var pfk = _.find(pt.fields, function(pf) {
				return pf.fk_table == t.name;
			});

			joinClause = joinClause 
				  + util.format(" INNER JOIN %s ON %s.%s = %s.id", 
								pt['name'], 
								pt['name'], pfk.name, 
								t['name']);
			distinct = true;
		}
			
		//console.log(joinClause);
	}
	return { 'sql': joinClause, 'distinct': distinct };
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
