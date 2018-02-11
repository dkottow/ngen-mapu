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


var mssql = require('mssql');
var Request = mssql.Request;

var _ = require('underscore');

var util = require('util');
var tmp = require('tmp'); //tmp database names
var config = require('config'); 

var Schema = require('../Schema.js').Schema;
var SchemaChange = require('../SchemaChange.js').SchemaChange;
var Database = require('../Database.js').Database;
var Table = require('../Table.js').Table;
var Field = require('../Field.js').Field;
var User = require('../User.js').User;

var SqlBuilder = require('./SqlBuilderMssql.js').SqlBuilderMssql;
var SqlHelper = require('./SqlHelperMssql.js').SqlHelperMssql;

var log = require('../log.js').log;
var funcs = require('../funcs.js');

/*
 * config 
 *
	user: 'dkottow', 
	password: '', 
	domain: 'GOLDER',
	server: 'localhost\\HOLEBASE_SI', 
	database: 'demo#sandwiches'
*/


var DatabaseMssql = function(config) 
{
	try {
		if ( ! (config && config.user && config.password && config.server && config.database)) {
			log.error({config: config}, 'Missing config. new DatabaseMssql()');
			return;
		}
		log.trace('new Database() ' + config.database);
		Database.call(this);
		this.config = _.clone(config);
	} catch(err) {
		log.error({err: err}, 'new Database()');
	}
}

DatabaseMssql.prototype = Object.create(Database.prototype);	

DatabaseMssql.prototype.name = function() {
	var fullName = this.config.database;
	return fullName.substr(fullName.indexOf(SqlHelper.ACCOUNT_DATABASE_SEPARATOR) + 1);
}

DatabaseMssql.prototype.connect = function() {
	if ( ! this.pool) {
		this.pool = new mssql.ConnectionPool(this.config);
	}
	if (this.pool.connecting) {
		//try again. later..
		var me = this;
		return new Promise(function(resolve, reject) {
			setTimeout(function() { resolve(me.connect()); }, 100);
		});
	}
	return this.pool.connected ? Promise.resolve() : this.pool.connect();
}

DatabaseMssql.prototype.connInfo = function() {
	return {
		min: this.pool.pool.min,
		max: this.pool.pool.max,
		size: this.pool.pool.size,
		available: this.pool.pool.available,
		pending: this.pool.pool.pending,
		borrowed: this.pool.pool.borrowed,
	}
}

DatabaseMssql.prototype.conn = function() {
	return this.pool;
} 


DatabaseMssql.prototype.get = function(tableName, options, cbResult) {

	try {
		log.debug("Database.get()...");

		cbResult = cbResult || arguments[arguments.length - 1];	
		options = typeof options == 'object' ? options : {};		

		var filterClauses = options.filter || [];
		var fields = options.fields || Table.ALL_FIELDS; 

		var table = this.table(tableName);
		var sql = this.sqlBuilder.selectSQL(table, fields, filterClauses, [], 1, 0, false);

		this.connect().then(() => {

			var req = this.conn().request();
			SqlHelper.addInputParams(req, sql.params);

			return req.query(sql.query);

		}).then(result => {
			//console.dir(result.recordset);
			var row = result.recordset[0];
			cbResult(null, row);

		}).catch(err => {
			log.error({err: err}, "Database.get() query exception.");
			cbResult(err, null);
		});

	} catch(err) {
		log.error({err: err}, "Database.get() exception.");	
		cbResult(err, []);
	}
}


DatabaseMssql.prototype.all = function(tableName, options, cbResult) {
	var me = this;
	try {
		log.debug("Database.all()...");
		var rows, countRows;
		var sql;
		var req;

		cbResult = arguments[arguments.length - 1];	
	
		var times = { 
			all: {},
			query: {}
		};

		funcs.startHRTime(times.all);

		//log.debug({ pool: this.connInfo() }, 'Database.all');

		this.connect().then(() => {

			sql = this.allSQL(tableName, options);
			req = this.conn().request();
			SqlHelper.addInputParams(req, sql.params);
			funcs.startHRTime(times.query);
			return req.query(sql.query);

		}).then(result => {
			funcs.stopHRTime(times.query);			
			log.trace({rows : result.recordset});
			rows = result.recordset;
			
			if ( ! sql.counts) {
				return Promise.resolve();
			}

			var countSql = sql.countSql 
				+ ' UNION ALL SELECT COUNT(*) as count FROM ' + tableName; 

			return req.query(countSql);
		
		}).then(result => {
			//console.dir(result.recordset);
			if (result) countRows = result.recordset;	
			funcs.stopHRTime(times.all);			
			sql.secs = times.all.secs;
			var result = this.allResult(tableName, rows, countRows, sql, options);
			cbResult(null, result);
			log.debug({time: { all: times.all.secs, query: times.query.secs }}, "perf Database.all()");
			log.trace({ result: result }, "...Database.all()");

		}).catch(err => {
			log.error({err: err}, "Database.all() query exception.");
			cbResult(err, null);
		});

	} catch(err) {
		log.error({err: err}, "Database.all() exception.");	
		cbResult(err, null);
	}
}

DatabaseMssql.prototype.allView = function(viewName, options, cbResult) {

	try {
		log.debug("Database.allView()...");

		cbResult = cbResult || arguments[arguments.length - 1];	
		options = typeof options == 'object' ? options : {};		
		var opts = this.allSanitizeOptions(options);

		var sql = this.sqlBuilder.selectViewSQL(viewName, opts.fields, opts.filter, 
												opts.order, opts.limit, opts.offset);

		this.connect().then(() => {

			var req = this.conn().request();
			SqlHelper.addInputParams(req, sql.params);

			return req.query(sql.query);

		}).then(result => {
			//console.dir(result.recordset);
			var rows = result.recordset;
			var result = this.allResult(viewName, rows, null, sql, options);
			cbResult(null, result);

		}).catch(err => {
			log.error({err: err}, "Database.allView() query exception.");
			cbResult(err, null);
		});

	} catch(err) {
		log.error(err, "Database.allView() exception.");	
		cbResult(err, []);
	}
}

DatabaseMssql.prototype.getCounts = function(cbResult) {
	log.trace("Database.getCounts()...");
	try {

		var counts = {};

		if (_.size(this.tables()) == 0) {
			cbResult(null, counts);
			return;
		}

		this.connect().then(() => {
			//get row counts
			var sql = _.map(_.keys(this.tables()), function(tn) {
				return 'SELECT ' + "'" + tn + "'" + ' AS table_name' 
						+ ', COUNT(*) AS count'
						+ ' FROM "' + tn + '"';
			});
			sql = sql.join(' UNION ALL ');
			//console.dir(sql);

			return this.conn().request().query(sql);

		}).then(result => {
			//console.dir(result.recordset);

			_.each(result.recordset, function(r) {
				counts[r.table_name] = r.count;	
			});

		}).then(result => {
			log.debug({counts: counts}, "..Database.getCounts()");
			cbResult(null, counts);

		}).catch(err => {
			log.error({err: err}, "Database.getCounts() query exception.");
			cbResult(err, null);
		});


	} catch(err) {
		log.error({err: err}, "Database.getCounts() exception. ");	
		cbResult(err, null);
	}
}

DatabaseMssql.prototype.getStats = function(tableName, options, cbResult) {

	log.trace("Database.getStats()...");
	try {

		var table = this.table(tableName);

		cbResult = cbResult || arguments[arguments.length - 1];	
		options = typeof options == 'object' ? options : {};		

		var filterClauses = options.filter || [];
		var fields = options.fields || Table.ALL_FIELDS; 

		var sql = this.sqlBuilder.statsSQL(table, fields, filterClauses);

		this.connect().then(() => {

			var req = this.conn().request();
			SqlHelper.addInputParams(req, sql.params);
			return req.query(sql.query);

		}).then(result => {
			log.trace({rows : result.recordset});
			var row = result.recordset[0];
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
			log.trace("...Database.getStats()");
			cbResult(null, result);

		}).catch(err => {
			log.error({err: err}, "Database.getStats() query exception.");
			cbResult(err, null);
		});

	} catch(err) {
		log.error({err: err}, "Database.getStats() exception.");	
		cbResult(err, null);
	}
}	


DatabaseMssql.prototype.readSchema = function(cbAfter) {

	var me = this;

	log.debug({db: this.config}, "Database.readSchema()");
	me._readingSchema = true;

	var schemaData = {
		name: this.name(),
		tables: {},
		views: {}
	};
	
	this.connect().then(() => {

		//read field definitions from information schema 
		var sql = 'SELECT T.table_name, T.table_type, C.column_name, C.data_type ' 
		+ ', C.character_maximum_length, C.numeric_precision, C.numeric_scale'
		+ ', C.is_nullable, C.column_default'  
		+ ' FROM information_schema.columns C'
		+ ' INNER JOIN information_schema.tables T'
		+ ' ON C.table_name = T.table_name '
		+ " WHERE T.table_type IN ('BASE TABLE', 'VIEW')";

		return this.conn().request().query(sql);

	}).then(result => {
		//console.dir(result.recordset);

		_.each(result.recordset, function(r) {
			try {
				var field = { 
					name: r.column_name,
					type: SqlHelper.Field.fromSQLType(r),
					notnull: 1*(r.is_nullable == 'NO')	//0 or 1
				};

				var tables = schemaData.tables;
				if (r.table_type == 'VIEW') {
					tables = schemaData.views;
				}

				if ( ! tables[r.table_name] ) {
					tables[r.table_name] = { 
						name: r.table_name,
						fields: {} 
					};					
				}

				tables[r.table_name].fields[r.column_name] = field;

			} catch(err) {
				log.warn({column: r, err: err}, 
					"DatabaseMssql.readSchema() failed. Ignoring column '" + r.column_name + "'");
			}
		});

	}).then(result => {

		//read foreign key definitions from information schema 
		var sql = 'SELECT KCU1.column_name'
		+ ', KCU1.table_name'
		+ ', KCU2.column_name AS fk_field'
		+ ', KCU2.table_name AS fk_table'
		+ ' FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS RC'
		+ ' JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE KCU1'
		+ '		ON KCU1.CONSTRAINT_CATALOG = RC.CONSTRAINT_CATALOG' 
		+ '		AND KCU1.CONSTRAINT_SCHEMA = RC.CONSTRAINT_SCHEMA'
		+ '		AND KCU1.CONSTRAINT_NAME = RC.CONSTRAINT_NAME'
		+ ' JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE KCU2'
		+ '		ON KCU2.CONSTRAINT_CATALOG = RC.UNIQUE_CONSTRAINT_CATALOG' 
		+ '		AND KCU2.CONSTRAINT_SCHEMA = RC.UNIQUE_CONSTRAINT_SCHEMA'
		+ '		AND KCU2.CONSTRAINT_NAME = RC.UNIQUE_CONSTRAINT_NAME'
		+ '		AND KCU2.ORDINAL_POSITION = KCU1.ORDINAL_POSITION';

		return this.conn().request().query(sql);

	}).then(result => {
		//console.log(result.recordset);
		
		_.each(result.recordset, function(r) {
			//foreign keys are only treated as such if they reference the id column of the fk table.
			if (r.fk_field == 'id') {
				var field = schemaData.tables[r.table_name].fields[r.column_name];
				field.fk = 1;
				field.fk_table = r.fk_table;
			}
		});

		log.trace({ schema: JSON.stringify(schemaData) }, 'Database.readSchema()');

		//read system properties 
		var sql = Schema.systemPropertySelectSQL();
		return this.conn().request().query(sql);

	}).then(result => {

		log.trace({ props: JSON.stringify(result.recordset) }, 'Database.readSchema()');

		Schema.setSystemProperties(schemaData, result.recordset);
		me.setSchema(schemaData);
		
		me._readingSchema = false;
		log.debug({ schema: me.schema.name }, '...Database.readSchema()');
		cbAfter();

	}).catch(err => {
		me._readingSchema = false;
		log.error({err: err}, "Database.readSchema() query exception.");
		cbAfter(err);
	});

}

DatabaseMssql.prototype.logTransactionError = function(err, fn) {
	log.debug({err: err}, fn + " log transaction error.");					
	if (err.code == 'EREQUEST' && err.originalError) {		
		err.originalError.stack = undefined;
		log.warn({err: err.originalError}, fn + " request sql error. Rollback.");					
	} else {
		err.stack = undefined;
		log.warn({err: err}, fn + " request error. Rollback");				
	}			
}

DatabaseMssql.prototype.insert = function(tableName, rows, options, cbResult) {
	var me = this;
	try {		
		log.debug('Database.insert()...');
		log.trace({table: tableName, rows: rows, options: options});

		cbResult = cbResult || arguments[arguments.length - 1];	
		options = typeof options == 'object' ? options : {};		

		var returnModifiedRows = options.retmod || false;

		if ( ! _.isArray(rows)) throw new Error("rows type mismatch");

		if (rows.length == 0) {
			cbResult(null, []);
			return;
		}

		var table = this.table(tableName);

		var fields = this.getInsertFields(rows, table);
		var fieldNames = _.keys(fields);
		var autoId = ! _.has(fields, 'id');

		var user = options.user || User.SystemUser();
		var add_by = user.name(); 
		var own_by = user.principal();

		var rowIds = [];
		var sql;

		var transaction;
		var stmt;

		this.connect().then(() => {

			transaction = new mssql.Transaction(this.conn());
			stmt = new mssql.PreparedStatement(transaction);

			_.each(fields, function(field) {
				var sqlType = SqlHelper.mssqlType(field.typeName());
				stmt.input(field.name, sqlType);
			});

			stmt.output('__id__', mssql.Int);

			return transaction.begin();

		}).then(() => {
			log.trace('transaction begin');

			if ( ! autoId) {
				var sql = util.format('SET IDENTITY_INSERT %s ON;', table.name);
			log.trace(sql);
				return new Request(transaction).batch(sql);
			} else {
				return Promise.resolve();
			}

		}).then(result => {

			log.trace('transaction began');
			var fieldParams = _.map(fieldNames, function(fn) { return '@' + fn; });

			var sql = "INSERT INTO " + table.name 
					+ '([' + fieldNames.join('], [') + '])'
					+ " VALUES (" + fieldParams.join(', ') + ");"

			if (autoId) {
				sql += "\nSELECT @__id__ = SCOPE_IDENTITY();";		
			} else {
				sql += "\nSELECT @__id__ = @id;"; 
			}

			log.debug({sql: sql}, "Database.insert()");

			return stmt.prepare(sql);

		}).then(result => {

			var doInsert = function(row, prevResult) {
				if (prevResult) {
					rowIds.push(prevResult.output.__id__);
				}

				if (row) {	

					row.add_on = row.mod_on = Field.dateToString(new Date());
					row.add_by = row.mod_by = add_by;
					row.own_by = row.own_by || own_by;

					var values = me.getFieldValues(row, fields);
					log.trace({values: values}, 'insert row');
					if (values.err) return Promise.reject(new Error(values.err));
					var valObj = _.object(fieldNames, values.values);	
					return stmt.execute(valObj);					
				} 

				return Promise.resolve();		
			};
		
			log.trace('stmt prepare');
			var chainPromises = _.reduce(rows, function(chainPromises, row) {
				return chainPromises.then(result => {
					return doInsert(row, result);
				});	
			}, Promise.resolve());	

			return chainPromises.then(result => {
				return doInsert(null, result);
			});

		}).then(() => {
			return stmt.unprepare();	

		}).then(() => {
			if ( ! autoId) {
				sql = util.format('SET IDENTITY_INSERT %s OFF;', table.name);
				return new Request(transaction).batch(sql);
			} else {
				return Promise.resolve();
			}

		}).then(() => {
			return transaction.commit();

		}).then(() => {
			log.trace({rowIds: rowIds}, 'committed');	
			if (returnModifiedRows) {
				return me.allById(tableName, rowIds, cbResult);
			} else {
				var rows = _.map(rowIds, function(id) { 
					return { id: id };
				});
				cbResult(null, { rows: rows }); 
			}

		}).catch(err => {
			this.logTransactionError(err, 'Database.insert()');

			stmt.unprepare().then(() => {
				return transaction.rollback();

			}).then(() => {
				cbResult(err, null);	

			}).catch(err => {
				log.error({err: err}, "Database.insert() rollback error.");
				cbResult(err, null);
				return;			
			});
		});

	} catch(err) {
		log.error({err: err}, "Database.insert() exception.");	
		cbResult(err, []);
	}
}

DatabaseMssql.prototype.update = function(tableName, rows, options, cbResult) {
	var me = this;
	try {
		log.debug('Database.update()...');
		log.trace({table: tableName, rows: rows, options: options});

		cbResult = cbResult || arguments[arguments.length - 1];	
		options = typeof options == 'object' ? options : {};		

		var returnModifiedRows = options.retmod || false;

		if ( ! _.isArray(rows)) throw new Error("rows type mismatch");

		if (rows.length == 0) {
			cbResult(null, []);
			return;
		}

		var table = this.table(tableName);
		var fields = this.getUpdateFields(rows, table);
		var fieldNames = _.keys(fields);

		var user = options.user || User.SystemUser();
		var mod_by = user.name();
		var modCount = 0;	

		var transaction;
		var stmt;

		this.connect().then(() => {

			transaction = new mssql.Transaction(this.conn());
			stmt = new mssql.PreparedStatement(transaction);

			_.each(fields, function(field) {
				var sqlType = SqlHelper.mssqlType(field.typeName());
				stmt.input(field.name, sqlType);
			});

			stmt.input('id', SqlHelper.mssqlType('integer'));

			return transaction.begin();

		}).then(() => {
			log.trace('transaction begin');

			var setSQL = _.reduce(fieldNames, function(memo, fn) {
				var term = SqlHelper.EncloseSQL(fn) + ' = @' + fn;
				if (memo.length == 0) return term;
				return memo + ', ' + term;
			}, '');

			var sql = "UPDATE " + table.name
					+ ' SET ' + setSQL
					+ " WHERE id = @id";

			log.debug({sql: sql}, "Database.update()");

			return stmt.prepare(sql);

		}).then(result => {

			var doUpdate = function(row, prevResult) {

				if (prevResult) {
					log.trace({prevResult: prevResult}, 'doUpdate result');
					modCount += prevResult.rowsAffected[0];
				}

				if (row) {	
					row.mod_on = Field.dateToString(new Date());
					row.mod_by = mod_by;

					var values = me.getFieldValues(row, fields);
					if (values.err) return Promise.reject(new Error(values.err));
					var valObj = _.object(fieldNames, values.values);	
					valObj['id'] = row.id;
					log.trace({values: valObj}, 'doUpdate values');

					return stmt.execute(valObj);				
				}

				return Promise.resolve();		
			};	

			var chainPromises = _.reduce(rows, function(chainPromises, row) {
				return chainPromises.then(result => {
					return doUpdate(row, result);
				});	
			}, Promise.resolve());

			return chainPromises.then(result => {
				return doUpdate(null, result);
			});

		}).then(result => {
			if (modCount != rows.length) {
				return Promise.reject(new Error("Update row count mismatch. Expected " + rows.length + " got " + modCount));
			}

			return stmt.unprepare();	

		}).then(() => {
			return transaction.commit();

		}).then(() => {
			var rowIds = _.pluck(rows, 'id');
			log.trace({rowIds: rowIds}, 'committed');	
			if (returnModifiedRows) {
				return me.allById(tableName, rowIds, cbResult);
			} else {
				rowIds = _.map(rowIds, function(id) { 
					return { id: id };
				});
				cbResult(null, { rows: rowIds }); 
			}

		}).catch(err => {
			this.logTransactionError(err, 'Database.update()');

			stmt.unprepare().then(() => {
				return transaction.rollback();

			}).then(() => {
				cbResult(err, null);	

			}).catch(err => {
				log.error({err: err}, "Database.update() rollback error.");
				cbResult(err, null);
				return;			
			});
		});

	} catch(err) {
		log.error({err: err, rows: rows}, "Database.update() exception.");	
		cbResult(err, null);
	}
}

DatabaseMssql.prototype.delete = function(tableName, rowIds, cbResult) {

	try {
		log.trace('Database.delete()...');
		log.trace({table: tableName, rowIds: rowIds});

		var table = this.table(tableName);
		if ( ! _.isArray(rowIds)) throw new Error("rowIds type mismatch");

		if (rowIds.length == 0) {
			cbResult(null, []);
			return;
		}

		var paramNames = [];
		var delCount = 0;

		var transaction;
		var stmt;

		this.connect().then(() => {

			transaction = new mssql.Transaction(this.conn());
			stmt = new mssql.PreparedStatement(transaction);

			_.each(rowIds, function(id) {
				var param = 'id' + id;
				stmt.input(param, SqlHelper.mssqlType('integer'));
				paramNames.push(param);
			});

			return transaction.begin();

		}).then(() => {
			log.trace('transaction begin');

			var idSQL = _.reduce(paramNames, function(memo, param) {
				var term = '@' + param;
				if (memo.length == 0) return term;
				return memo + ', ' + term;
			}, '');

			var sql = "DELETE FROM " + table.name 
					+ " WHERE id IN (" + idSQL + ")";

			log.debug({sql: sql}, "Database.delete()");
			return stmt.prepare(sql);

		}).then(result => {
			var valObj = _.object(paramNames, rowIds);
			return stmt.execute(valObj);				

		}).then(result => {
			log.trace({result: result}, 'delete result');
			delCount = result.rowsAffected[0];

			if (delCount != rowIds.length) {
				//console.log(delCount + " <> " + rowIds.length);
				Promise.reject(new Error("Delete row count mismatch. Expected " + rowIds.length + " got " + delCount));
			}

			return stmt.unprepare();	

		}).then(() => {
			return transaction.commit();

		}).then(() => {
			cbResult(null, rowIds); 

		}).catch(err => {
			this.logTransactionError(err, 'Database.delete()');

			stmt.unprepare().then(() => {
				return transaction.rollback();

			}).then(() => {
				cbResult(err, null);	

			}).catch(err => {
				log.error({err: err}, "Database.delete() rollback error.");
				cbResult(err, null);
				return;			
			});
		});

	} catch(err) {
		log.error({err: err, rowIds: rowIds}, "Database.delete() exception.");	
		cbResult(err, null);
	}
}

DatabaseMssql.prototype.execSP = function(spName, args, cbResult) {
	try {
		log.trace('Database.execSP()...');
		log.trace({storedProcedure: spName, args: args});

		this.connect().then(() => {

			var req = this.conn().request();
			SqlHelper.addInputParams(req, args.input);
			SqlHelper.addOutputParams(req, args.output);
			return req.execute(spName);

		}).then(result => {
			log.trace({result: result}, 'execSP result');
			cbResult(null, result);

		}).catch(err => {
			log.error({err: err}, "Database.execSP() query exception.");
			cbResult(err, null);
			return;		
		});

	} catch(err) {
		log.error({err: err}, "Database.execSP() exception.");	
		cbResult(err, null);
	}
}


DatabaseMssql.prototype.chown = function(tableName, rowIds, owner, cbResult) {
	var me = this;
	try {
		log.trace('Database.chown()...');
		log.trace({table: tableName, rowIds: rowIds, owner: owner});

		var table = this.table(tableName);
		if ( ! _.isArray(rowIds)) throw new Error("rowIds type mismatch");

		if (rowIds.length == 0) {
			cbResult(null, 0);
			return;
		}

		var chownCount = 0;
		var transaction;
		var stmt;

		this.connect().then(() => {

			transaction = new mssql.Transaction(this.conn());
			stmt = new mssql.PreparedStatement(transaction);
			return transaction.begin();

		}).then(() => {

			var doChown = function(chownTable, prevResult) {

				if (prevResult) {
					log.trace({prevResult: prevResult}, 'doChown result');
					chownCount += prevResult.rowsAffected[0];
				}

				if (chownTable) {	

					var sql = me.sqlBuilder.chownSQL(table, rowIds, chownTable, owner);
					log.trace({sql: sql}, 'doChown sql');

					var req = new Request(transaction);
					SqlHelper.addInputParams(req, sql.params);
					return req.query(sql.sql);				
				}

				return Promise.resolve();		
			};	

			var chainPromises = Promise.resolve();	

			var chownTables = [ table ];
			while(chownTables.length > 0) {
				let t = chownTables.shift(); //only let (not var) will work here!
				var childTables = me.childTables(t.name);
				chownTables = chownTables.concat(childTables);
				
				chainPromises = chainPromises.then(result => {
					return doChown(t, result);
				});
			}

			return chainPromises.then(result => {
				return doChown(null, result);
			});

		}).then(() => {
			return transaction.commit();

		}).then(() => {
			cbResult(null, { rowCount: chownCount }); 

		}).catch(err => {
			this.logTransactionError(err, 'Database.chown()');

			transaction.rollback().then(() => {
				cbResult(err, null);	

			}).catch(err => {
				log.error({err: err}, "Database.chown() rollback error.");
				cbResult(err, null);
				return;			
			});
		});
			
	} catch(err) {
		log.error({err: err, rowIds: rowIds}, "Database.chown() exception.");	
		cbResult(err, null);
	}
}

DatabaseMssql.prototype.writeSchema = function(cbAfter) {
	var me = this;
	try {
		log.debug('DatabaseMssql.writeSchema..');
		var dbTemp = tmp.tmpNameSync({ template: SqlHelper.Schema.fullName('tmp', 'XXXXXX') });

		var dbConfig = _.clone(this.config);
		dbConfig.database = 'master'; //connect to master
		dbConfig.requestTimeout = 100*1000; //100s - create db can take some time..

		var sqlBatches;
		var transaction;	
		var doRollback;
		var conn = new mssql.ConnectionPool(dbConfig);

		this.sqlBuilder.createDatabaseSQLBatches(this.schema).then(result => {
			sqlBatches = result;
			log.debug('connect to master');
			return conn.connect();

		}).then(result => {
			log.debug('create database ' + dbTemp);
			var sql = util.format('CREATE DATABASE [%s]', dbTemp);
			if (config.sql.elasticPool && config.sql.elasticPool.length > 0) {
				sql += util.format(' (SERVICE_OBJECTIVE = ELASTIC_POOL(name = [%s]))', config.sql.elasticPool);
			}
			//TODO? add pricing tier 
			//sql = sql + ' (SERVICE_OBJECTIVE = ELASTIC_POOL(name = [S3M100]))'; 
			return conn.request().batch(sql);

		}).then(result => {
			log.debug('close conn master');
			return conn.close();	

		}).then(result => {
			log.debug('connect to ' + dbTemp);
			dbConfig.database = dbTemp;
			conn = new mssql.ConnectionPool(dbConfig);
			return conn.connect();

		}).then(result => {

			log.debug('transaction begin');
			transaction = new mssql.Transaction(conn);
			return transaction.begin();

		}).then(result => {
			log.debug('execute sql batches');
			doRollback = true;
			transaction.on('rollback', aborted => {
				// emitted with aborted === true
				doRollback = false;
			});
			
			var chainPromises = _.reduce(sqlBatches, function(chainPromises, sql) {
				return chainPromises.then(result => {
					log.trace({sql: sql}, 'create sql batch');
					return new Request(transaction).batch(sql);	
				});	
			}, Promise.resolve());

			return chainPromises;

		}).then(result => {
			log.debug('commit');
			return transaction.commit();

		}).then(result => {
			doRollback = false;
			if (config.sql.fullTextSearch) {
				log.debug('create full text catalog');
				return new Request(conn).batch(SqlHelper.Schema.createFullTextCatalogSQL(this.name()));
			} else {
				return Promise.resolve();
			}

		}).then(result => {
			if (config.sql.fullTextSearch) {
				log.debug('create full text indices');
				var searchSQLs = _.map(this.tables(), function(table) {
					return SqlHelper.Table.createSearchSQL(table); 	
				}, this);

				var chainPromises = _.reduce(searchSQLs, function(chainPromises, sql) {
					return chainPromises.then(result => {
						return new Request(conn).batch(sql);	
					});	
				}, Promise.resolve());

				return chainPromises;
			} else {
				return Promise.resolve();
			}	

		}).then(err => {
			log.debug('close conn');
			return conn.close();	

		}).then(err => {
			log.debug('then connect to master');
			dbConfig.database = 'master';
			return conn.connect();

		}).then(result => {	
			log.debug('then drop');
			var dropSQL = SqlHelper.Schema.dropSQL(this.config.database);
			return conn.request().batch(dropSQL);

		}).then(result => {
			log.debug('then rename to ' + this.config.database);
			var sql = util.format('ALTER DATABASE [%s] Modify Name = [%s];'
						, dbTemp, this.config.database);	
			return conn.request().batch(sql);

		}).then(result => {
			log.debug('...Database.writeSchema()');
			conn.close();
			cbAfter();

		}).catch(err => {
			this.logTransactionError(err, 'Database.writeSchema()');

			if (transaction && doRollback) {
				transaction.rollback().then(() => {
					return conn.close();

/*
				}).then(() => {
					DatabaseMssql.remove(dbConfig, dbTemp, function() { cbAfter(err); });	
*/

				}).catch(err => {
					log.error({err: err}, "Database.writeSchema() rollback exception.");
					cbAfter(err); 
				});

			} else if (conn.connected) {
				conn.close();
			}
		});	

	} catch(err) {
		log.error({err: err}, "Database.writeSchema() exception.");
		cbAfter(err);
	}
}

DatabaseMssql.prototype.writeSchemaChanges = function(changes, cbAfter) {
	var me = this;
	try {

		var transaction;
		var doRollback;

		this.connect().then(() => {

			transaction = new mssql.Transaction(this.conn());
			return transaction.begin();

		}).then(() => {

			doRollback = true;
			transaction.on('rollback', aborted => {
				// emitted with aborted === true
				doRollback = false;
			});

			var changesSQL = _.reduce(changes, function(acc, change) {
				var sql = change.toSQL(me.sqlBuilder);
				return acc.concat(sql);
			}, []);
			log.debug({changeSQL: changesSQL}, 'DatabaseMssql.writeSchemaChanges()');

			var chainPromises = _.reduce(changesSQL, function(promises, sql) {
				return promises.then(result => {
					//console.log('change batch SQL ' + sql);
					return new Request(transaction).batch(sql);	
				});	
			}, Promise.resolve());	

			return chainPromises;

		}).then(result => {
			log.trace('then commit');
			return transaction.commit();

		}).then(() => {

			doRollback = false;
			var afterSQL = _.reduce(changes, function(acc, change) {
				var sql = change.afterSQL(me.sqlBuilder);
				return acc.concat(sql);
			}, []);
			log.debug({afterSQL: afterSQL}, 'DatabaseMssql.writeSchemaChanges()');

			var chainPromises = _.reduce(afterSQL, function(promises, sql) {
				return promises.then(result => {
					//console.log('change batch SQL ' + sql);
					return new Request(me.conn()).batch(sql);
				});	
			}, Promise.resolve());	

			return chainPromises;

		}).then(() => {
			cbAfter(); 

		}).catch(err => {
			this.logTransactionError(err, 'Database.writeSchemaChanges()');
			if (doRollback) {
				transaction.rollback().then(() => {
					cbAfter(err);	

				}).catch(err => {
					log.error({err: err}, "Database.writeSchemaChanges() rollback error.");
					cbAfter(err);
					return;			
				});
			} else {
				log.error({err: err}, "Database.writeSchemaChanges() error.");
				cbAfter(err);				
			}	
		});


	} catch(err) {
		log.error({err: err}, 
			"DatabaseMssql.writeSchemaChanges() exception.");
		cbAfter(err);
	}
}

DatabaseMssql.remove = function(dbConfig, dbName, cbAfter) {
	try {
		log.debug({dbConfig: dbConfig, dbName: dbName }, 'DatabaseMssql.remove..');

		var config = _.clone(dbConfig);
		config.database = 'master'; //connect to master

		var conn = new mssql.ConnectionPool(config);
		conn.connect().then(pool => {
			return new Request(conn).batch(SqlHelper.Schema.dropSQL(dbName));
		
		}).then(result => {
			cbAfter(); 	

		}).catch(err => {
			log.error({err: err}, "Database.remove() batch exception.");
			cbAfter(err);
			return;
		});

		conn.on('error', err => {
			log.error({err: err}, "Database.remove() SQL error.");
			cbAfter(err);
		});

	} catch(err) {
		log.error({err: err}, "Database.remove() exception.");
		cbAfter(err);
	}
}

exports.DatabaseMssql = DatabaseMssql;
