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

var  fs = require('fs');
var  path = require('path');
var _ = require('underscore');
var util = require('util');
var assert = require('assert');
var validator = require('validator');
var jsonpatch = require('fast-json-patch');

var tmp = require('tmp'); //tmp filenames

var sqlite3 = require('sqlite3').verbose();

var Field = require('./Field.js').Field;
var Table = require('./Table.js').Table;
var TableGraph = require('./TableGraph.js').TableGraph;
var SqlBuilder = require('./SqlBuilder.js').SqlBuilder;

var SchemaChange = require('./SchemaChange.js').SchemaChange;

var log = require('./log.js').log;

global.tmp_dir = global.tmp_dir || '.';

var Schema = function() {
	this.graph = null;
}

Schema.EMPTY = {
	tables: []
	, join_trees: []
	, users: []
}

Schema.USER_ROLES = {
	OWNER: "owner",
	WRITER: "writer",
	READER: "reader"
};

Schema.prototype.init = function(schemaData) {
	try {
		log.trace('Schema.init()...');
		log.trace({data: schemaData});
		
		schemaData = schemaData || Schema.EMPTY;
		
		var tables = _.map(schemaData.tables, function(tableDef) {
			return new Table(tableDef);
		});

		var options = _.pick(schemaData, 'join_trees');
		this.graph = new TableGraph(tables, options);
		this.sqlBuilder = new SqlBuilder(this.graph);
		this.users = schemaData.users || [];

		log.trace('...Schema.init()');

	} catch(err) {
		log.error({err: err, data: schemaData}, "Schema.init() exception.");
		throw err;
	}
}

Schema.prototype.get = function() {

	try {
		
		var result = this.graph.toJSON();
		result.name = this.name;
		result.users = this.users; 
		return result;
		
	} catch(err) {
		log.error({err: err}, "Schema.get() exception.");
		throw err;
	}
}

/******* table ops *******/

Schema.prototype.tables = function() {
	var tables = this.graph.tables();
	return _.object(_.pluck(tables, 'name'), tables);
}

Schema.prototype.table = function(name) { 
	return this.tables()[name];
}

Schema.prototype.setTable = function(table) { 
	return this.addTable(table);
}

Schema.prototype.addTable = function(table) { 
	if ( ! table instanceof Table) 
		throw new Error('Type mismatch error on addTable'); 

	var schemaData = this.get();
	schemaData.tables[table.name] = table.toJSON();
	this.init(schemaData);	
}

Schema.prototype.removeTable = function(name) { 
	var schemaData = this.get();
	delete schemaData.tables[name];
	//TODO - remove table from possible join_trees?
	this.init(schemaData);	
}

/******* user ops *******/


Schema.prototype.user = function(name) {
	var user = _.find(this.users, function(u) { 
		return u.name == name; 
	});
	return user;
}

Schema.prototype.setUser = function(name, role) {
	if (!role) {
		delete this.users[name];
		return;
	}
	if ( ! _.contains(Schema.USER_ROLES, role)) { 
		throw new Error(util.format('user role %s unknown.', role));
	}
	var user = this.user(name);
	if (user) user.role = role;
	else this.users.push({name: name, role:role});
}

//used in ApiController, smells bad..
Schema.setAdmin = function(schemaDef, admin) {
	if (_.findIndex(schemaDef.users, { name : admin }) < 0) {
		schemaDef.users.push({name: admin, role: Schema.USER_ROLES.OWNER });
	}
}

/******* file ops *******/

Schema.prototype.write = function(dbFile, cbAfter) {
	var me = this;
	try {

		var createSQL = this.sqlBuilder.createSQL(this);

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
					log.error("Schema.write() failed. " + err);	
					fs.unlink(tmpFile);
					cbAfter(err);
					return;
				}
				me.setName(dbFile);
				log.debug('rename ' + tmpFile + ' to ' + dbFile);	
				fs.rename(tmpFile, dbFile, function(err) {						
					cbAfter(err);
				});
			});
		});

	} catch(err) {
		log.error({err: err}, "Schema.write() exception.");
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
		log.debug({db: path.basename(dbFile)}, "Schema.read()");
		var me = this;
		var db = new sqlite3.Database(dbFile
							, sqlite3.OPEN_READONLY
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

			var fields = _.map(Schema.TABLE_FIELDS, function(f) {
				return '"' + f + '"';
			});
			var sql = 'SELECT ' + fields.join(',') 
					+ ' FROM ' + Schema.TABLE;

			//read schema properties 
			db.all(sql, function(err, rows) {
				dbErrorHandlerFn(err);

				var schemaProps = {};
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
							me.init();
							me.setName(dbFile);
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
						table.access_control = props.access_control;
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
								var data = {
									tables: tables
								};
								_.extend(data, schemaProps);
								me.init(data);
								me.setName(dbFile);
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
		});
	} catch(err) {
		log.error({err: err}, "Schema.read() exception.");
		cbAfter(err);
	}
}

Schema.prototype.jsonWrite = function(fileName, cbAfter) {
	var me = this;
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

			me.setName(fileName);
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
			me.setName(fileName);
			cbAfter();
			
		});

	} catch(err) {
		log.error({err: err, file: fileName}, 
			"Schema.jsonRead() exception.");
		cbAfter(err);
	}
}

// private methods..

Schema.prototype.setName = function(fileName) {
	var fn = path.basename(fileName);
	this.name = fn.substr(0, fn.lastIndexOf('.')) || fn;
}



Schema.prototype.patchesToChanges = function(patches, rowCounts) {

	try {
		var patchSequences = {}; //sequence of changes of same type
	
		 _.each(patches, function(patch) {
		
			var change = SchemaChange.create(patch, this);
			if (change) {
				patch.path = change.patchPath();
	
				var key = change.key();
				patchSequences[key] = patchSequences[key] || [];
				patchSequences[key].push({
					patch: patch,
					change: change
				});						

			} else {
				log.error({patch: patch}, 'Schema.patchesToChanges()');
				throw new Error('Patch sequence contains unsupported patch');
			}
			
		}, this);
		
		var changes = [];
		_.each(patchSequences, function(changePatch) {			
			var change = changePatch[0].change;
			if (change.obj) {
				var patches = _.pluck(changePatch, 'patch');
				jsonpatch.apply(change.obj, patches);
			}
			changes.push(change);
		});
		
		return { changes: changes };

	} catch(err) {
		log.error({err: err, patches: patches}, 
			"Schema.patchesToChanges() exception.");
		return { error: err };
	}
}

Schema.prototype.applyChanges = function(changes) {

	_.each(changes, function(change) {
		try {
			if (change.schema != this) {
				throw new Error('Schema mismatch. Internal Error.');
			}
			change.apply();
		} catch(err) {
			log.error({err: err, change: change}, 
					"Schema.applyChanges() exception.");
			throw err;		
		}
	}, this);
	
	this.init(this.get()); //rebuild objs from json (e.g. TableGraph)
}

Schema.prototype.writeChanges = function(dbFile, changes, cbAfter) {
	try {

		var sql = _.reduce(changes, function(sql, change) {
			return sql + change.toSQL() + '; \n';
		}, '');


		log.debug({sql: sql}, "Schema.writePatches()");
		if (sql.length == 0) {
			cbAfter();
			return;
		}

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
				log.error({err: err, sql: sql}, 
					"Schema.writePatches() exception. Rollback.");
				cbAfter(err);				
			});
		}

	} catch(err) {
		log.error({err: err}, 
			"Schema.writeChanges() exception.");
		cbAfter(err);
	}
}

Schema.TABLE = "__schemaprops__";
Schema.TABLE_FIELDS = ['name', 'value'];

//Schema.PROPERTIES = [];

Schema.prototype.persistentProps = function() {
	var props = { 
		join_trees: this.graph.joinTreesJSON(),
		users: this.users
	};
	return props;
}

Schema.prototype.updatePropSQL = function(opts) {

	opts = opts || {};
	var deep = opts.deep || false;

	var sql = _.map(this.persistentProps(), function(v, k) {
		return "UPDATE " + Schema.TABLE 
			+ " SET value = '" + JSON.stringify(v) + "'"
			+ " WHERE name = '" + k + "'; ";		
	}).join('\n');

	if (deep) {
		_.each(this.tables(), function(t) {
			sql += "\n" + t.updatePropSQL(opts);
		}, this);
	}

	log.debug({sql: sql}, "Schema.updatePropSQL()");
	return sql;
}

Schema.prototype.insertPropSQL = function(opts) {

	opts = opts || {};
	var deep = opts.deep || false;

	var values = _.map(this.persistentProps(), function(v, k) {
		return "('" + k + "', '" + JSON.stringify(v) + "')";
	});

	var fields = _.map(Schema.TABLE_FIELDS, function(f) {
		return '"' + f + '"';
	});

	var sql = 'INSERT INTO ' + Schema.TABLE
			+ ' (' + fields.join(',') + ') ' 
			+ ' VALUES ' + values.join(',') + '; ';

	if (deep) {
		_.each(this.tables(), function(t) {
			sql += "\n" + t.insertPropSQL(opts);
		}, this);
	}

	log.debug({sql: sql}, "Schema.insertPropSQL()");
	return sql;
}

exports.Schema = Schema;

