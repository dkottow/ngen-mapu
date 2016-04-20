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

var Schema = function() {
	this.graph = null;
}

Schema.EMPTY = {
	tables: [],
	join_trees: []
}

Schema.prototype.init = function(schemaData) {
	try {
		log.debug({data: schemaData}, 'Schema.init()...');
		
		schemaData = schemaData || Schema.EMPTY;
		
		var tables = _.map(schemaData.tables, function(tableDef) {
			return new Table(tableDef);
		});

		this.graph = new TableGraph(tables);
		this.sqlBuilder = new SqlBuilder(this.graph);

		log.debug({tables: tables}, '...Schema.init()');

	} catch(err) {
		log.error({err: err, data: schemaData}, "Schema.init() exception.");
		throw err;
	}
}

Schema.prototype.tables = function() {
	try {
		if ( ! this._tables) {
			this._tables = this.graph.tables();
		}
		return this._tables;

	} catch(err) {
		log.error({err: err}, "Schema.tables() exception.");
		throw err;
	}
}

Schema.prototype.table = function(name) { 
	var table = _.find(this.tables(), function(t) { 
		return t.name == name; 
	});
	if ( ! table) {
		throw new Error(util.format('Table %s not found.', name));
	}
	return table;
}

Schema.prototype.get = function() {

	try {
		
		return this.graph.toJSON();
		
	} catch(err) {
		log.error({err: err}, "Schema.get() exception.");
		throw err;
	}
}

Schema.PATCH_OPS = {
	SET_PROP: 'set_prop', 
	ADD_FIELD: 'add_field', 
	ADD_TABLE: 'add_table'
};

Schema.prototype.parsePatch = function(patch) {

	if ( ! _.contains(Schema.PATCH_OPS, patch.op)) {
		throw new Error("Unknown patch op. " + patch.op);
	}

	if (patch.op == 'set_prop') {

		var path = patch.path.split('/');
		if (path[0].length == 0) path.shift();

		var table = this.table(path.shift());
		var prop = path.pop();

		if (path.length == 0) {			
			return {
				op: patch.op,
				table: table,
				prop: prop,
				value: patch.value,
				apply: function() {
					table.setProp(prop, patch.value);
				}							
			}
		} else if (path.length == 1) {			
			var field = table.field(path.shift());
			return {
				op: patch.op,
				table: table,
				field: field,
				prop: prop,
				value: patch.value,
				apply: function() {
					field.setProp(prop, patch.value);
				}							
			}
		}
	}
	return {};
}

Schema.prototype.patch = function(patch) {
	try {	
		var patchHandler = this.parsePatch(patch);		
		patchHandler.apply();

	} catch(err) {
		log.error({err: err, patch: patch}, "Schema.patch() exception.");
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
		log.error({err: err}, "Schema.create() exception.");
		cbAfter(err);
	}
}

Schema.remove = function(dbFile, cbAfter) {
	fs.unlink(dbFile, function(err) {
		if (err) {
			log.error({err: err}, "Schema.remove() failed.");	
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
				log.error({err: err, file: dbFile}, 
					"Schema.read() failed. Could not open file.");
				cbAfter(err);
				return;
			}

			var dbErrorHandlerFn = function(err) {
				if (err) {
					db.close();
					log.error({err: err}, "Schema.read() failed.");
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

				//handle empty schema
				if (rows.length == 0) {
					db.close(function() {
						me.init();
						cbAfter();
						return;
					});
				}

				var tables = _.map(rows, function(r) {
					var table = { 
						name: r.name
						, disabled: r.disabled
					};
					table.row_alias = JSON.parse(r.row_alias);
					table.props = JSON.parse(r.props);
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
							name: r.name
							, disabled: r.disabled
						};
						field.props = JSON.parse(r.props);

						tables[r.table_name].fields[r.name] = field;
					});

					var doAfter = _.after(2*tableNames.length, function() {
						//after executing two SQL statements per table
						db.close(function () {
							me.init({ tables: tables });
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
		log.error({err: err}, "Schema.read() exception.");
		cbAfter(err);
	}
}

Schema.prototype.jsonWrite = function(fileName, cbAfter) {
	try {
		var data = _.pick(this.get(), _.keys(Schema.EMPTY));
		fs.writeFile(fileName, JSON.stringify(data), function(err) {
			if (err) {
				log.error({data: data, error: err}
					, "Schema.jsonWrite() failed. Could not write to '" 
					+ fileName + "'");
				cbAfter(err);
				return;
			}

			cbAfter();
		});

	} catch(err) {
		log.error({err: err}, "Schema.jsonWrite() exception.");
		cbAfter(err);
	}
}

Schema.prototype.jsonRead = function(fileName, cbAfter) {
	var me = this;
	try {

		fs.readFile(fileName, 'utf8', function(err, data) {
			if (err) {
				log.error({err: err, file: fileName}, 
					"Schema.jsonRead() failed. Could not open file.");
				cbAfter(err);
				return;
			}

			try {
				data = JSON.parse(data);

			} catch(err) {
				log.error({err: err, data: data}, 
					"Schema.jsonRead() parse error.");
				cbAfter(err);
				return;
			}

			me.init(data);
			cbAfter();
			
		});

	} catch(err) {
		log.error({err: err, file: fileName}, 
			"Schema.jsonRead() exception.");
		cbAfter(err);
	}
}

Schema.prototype.writePatches = function(dbFile, patchDefs, cbAfter) {
	try {

		var patches = _.map(patchDefs, function(p) {
			return this.parsePatch(p);
		}, this);

		var propPatches = _.filter(patches, function(p) {
			return p.op == 'set_prop';
		}, this);

		var sql = this.sqlBuilder.updatePropSQL(propPatches);
		log.debug({sql: sql});

		var db = new sqlite3.Database(dbFile);
		
		try {

			db.serialize(function() {
				db.run("PRAGMA foreign_keys = ON;");
				db.run("BEGIN TRANSACTION");
				db.exec(sql);
				db.run("COMMIT TRANSACTION");
				db.close(function() {
					cbAfter();
				});
			});

		} catch(err) {
			db.run("ROLLBACK TRANSACTION");
			db.close(function() {
				log.error({err: err, patches: patches}, 
					"Schema.writePatches() exception. Rollback.");
				cbAfter(err);				
			});
		}

	} catch(err) {
		log.error({err: err, patches: patches}, 
			"Schema.writePatches() exception.");
		cbAfter(err);
	}
}


exports.Schema = Schema;

