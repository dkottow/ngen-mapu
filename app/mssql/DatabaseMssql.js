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

var Schema = require('../Schema.js').Schema;
var SchemaChange = require('../SchemaChange.js').SchemaChange;
var Database = require('../Database.js').Database;
var Field = require('../Field.js').Field;
var Table = require('../Table.js').Table;

var SqlBuilder = require('./SqlBuilderMssql.js').SqlBuilderMssql;
var SqlHelper = require('./SqlHelperMssql.js').SqlHelperMssql;

var log = require('../log.js').log;

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
	log.trace('new Database ' + config.database);
	Database.call(this);
	this.config = config;
	this.pool = new mssql.ConnectionPool(this.config);
}

DatabaseMssql.prototype = Object.create(Database.prototype);	

DatabaseMssql.prototype.init = function(cbAfter) {
	log.debug('Database.init()...');
	this.pool.connect(err => { 
		log.info({config: this.config }, 'mssql.connect() succeeded.');
		cbAfter(err); 
	});
}

DatabaseMssql.prototype.connect = function(cbAfter) {
	this.pool.connect(err => {
		cbAfter(err);
	});
}

DatabaseMssql.prototype.conn = function() {
	return this.pool;
} 


DatabaseMssql.prototype.get = function(tableName, options, cbResult) {

	try {
		log.debug("Database.get()...");

		var table = this.table(tableName);

		cbResult = cbResult || arguments[arguments.length - 1];	
		options = typeof options == 'object' ? options : {};		

		var filterClauses = options.filter || [];
		var fields = options.fields || Table.ALL_FIELDS; 

		var sql = this.sqlBuilder.selectSQL(table, fields, filterClauses, [], 1, 0, false);

		var req = this.conn().request();

		SqlHelper.addInputParams(req, sql.params);

		req.query(sql.query).then(result => {
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

	try {
		log.debug("Database.all()...");

		var table = this.table(tableName);

		cbResult = arguments[arguments.length - 1];	
		options = typeof options == 'object' ? options : {};		

		var filterClauses = options.filter || [];
		var fields = options.fields || Table.ALL_FIELDS; 
		var order = options.order || [];
		var limit = options.limit || global.row_max_count;
		var offset = options.offset || 0;

		var query = {
			table : tableName
			, select: fields
			, filter : filterClauses
			, orderby: order
			, top: limit
			, skip: offset 
		};

		var debug = options.debug || false;

		log.trace(fields + " from " + table.name 
				+ " filtered by " + util.inspect(filterClauses));

		var resultAll = { 
			query: query
		}

		var sql = this.sqlBuilder.selectSQL(
					table, fields, filterClauses, 
					order, limit, offset);
		//console.dir(sql);
		log.debug({sql: sql.query}, "Database.all()");

		var req = this.conn().request();

		SqlHelper.addInputParams(req, sql.params);

		req.query(sql.query).then(result => {
			log.trace({rows : result.recordset});
			resultAll.rows = result.recordset;

		}).then(result => {
			
			var countSql = sql.countSql 
				+ ' UNION ALL SELECT COUNT(*) as count FROM ' + table.name; 

			return req.query(countSql);
		
		}).then(result => {
			//console.dir(result.recordset);
			resultAll.count = result.recordset[0].count;
			resultAll.totalCount = result.recordset[1].count;

			var expectedCount = result.recordset[0].count - offset;

			if (resultAll.rows.length < expectedCount) {
				resultAll.nextOffset = offset + limit;
			}

			if (debug) {
				resultAll.sql = sql.query;
				resultAll.sqlParams = sql.params;
			}		

			cbResult(null, resultAll);
			log.trace({ result: resultAll }, "...Database.all()");

		}).catch(err => {
			log.error({err: err}, "Database.all() query exception.");
			cbResult(err, null);
		});

	} catch(err) {
		log.error({err: err}, "Database.all() exception.");	
		cbResult(err, null);
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

		//get row counts
		var sql = _.map(_.keys(this.tables()), function(tn) {
			return 'SELECT ' + "'" + tn + "'" + ' AS table_name' 
					+ ', COUNT(*) AS count'
					+ ' FROM "' + tn + '"';
		});
		sql = sql.join(' UNION ALL ');
		//console.dir(sql);

		this.conn().request().query(sql).then(result => {
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

		var req = this.conn().request();

		SqlHelper.addInputParams(req, sql.params);

		req.query(sql.query).then(result => {
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

	try {
		log.debug({db: this.config.database}, "Schema.read()");

		var schemaProps = {
			name: this.config.database
		};
		
		var fields = _.map(Schema.TABLE_FIELDS, function(f) {
			return '"' + f + '"';
		});

		//read schema properties 
		var sql = 'SELECT ' + fields.join(',') 
				+ ' FROM ' + Schema.TABLE;

		this.conn().request().query(sql).then(result => {
			//console.dir(result.recordset);

			_.each(result.recordset, function(r) {
				schemaProps[r.name] = JSON.parse(r.value);
			});

			var fields = _.map(Table.TABLE_FIELDS, function(f) {
				return '"' + f + '"';
			});

			//read table properties 
			var sql = 'SELECT ' + fields.join(',') 
					+ ' FROM ' + Table.TABLE;

			return this.conn().request().query(sql);

		}).then(result => {
			//console.dir(result.recordset);

			//handle empty schema
			if (result.recordset.length == 0) {
				me.setSchema(schemaProps);
				this.close();
				cbAfter();
				return;
			}

			var tables = _.map(result.recordset, function(r) {
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

			schemaProps.tables = _.object(_.pluck(tables, 'name'), tables);
				
			var fields = _.map(Field.TABLE_FIELDS, function(f) {
				return '"' + f + '"';
			});

			//read field properties 
			var sql = 'SELECT ' + fields.join(',') 
					+ ' FROM ' + Field.TABLE;

			return this.conn().request().query(sql);

		}).then(result => {
			//console.dir(result.recordset);

			_.each(result.recordset, function(r) {
				var field = { 
					name: r.name,
					disabled: r.disabled,
					fk: 0	
				};
				var props =  JSON.parse(r.props);
				field.props = _.pick(props, Field.PROPERTIES);
				schemaProps.tables[r.table_name].fields = schemaProps.tables[r.table_name].fields || {};
				schemaProps.tables[r.table_name].fields[r.name] = field;
			});

			//read field definitions from information schema 
			var sql = 'SELECT table_name, column_name, data_type ' 
					+ ', character_maximum_length, numeric_precision, numeric_scale'
					+ ', is_nullable, column_default'  
					+ ' FROM information_schema.columns'
					+ util.format(' WHERE table_name in (%s)', "'" 
						+ _.pluck(schemaProps.tables, 'name').join("', '") + "'");

			return this.conn().request().query(sql);

		}).then(result => {
			//console.dir(result.recordset);

			_.each(result.recordset, function(r) {
				var field = schemaProps.tables[r.table_name].fields[r.column_name];
				if (r.data_type == 'varchar') {
					field.type = util.format('%s(%s)', r.data_type.toUpperCase(), 
									(r.character_maximum_length > 0) ? r.character_maximum_length : 'MAX');
				} else if (r.data_type == 'numeric') {
					field.type = util.format('%s(%s,%s)', r.data_type.toUpperCase(), 
									r.numeric_precision, r.numeric_scale);
				} else if (r.data_type == 'int') {
					field.type = 'INTEGER';
				} else {
					//int, datetime, date
					field.type = r.data_type.toUpperCase();					
				}
				field.notnull = 1*(r.is_nullable == 'NO');	//0 or 1
			});

			//read foreign key definitions from information schema 
			var sql = 'SELECT KCU1.column_name'
					+ ', KCU1.table_name'
					+ ', KCU2.TABLE_NAME AS fk_table'
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
				var field = schemaProps.tables[r.table_name].fields[r.column_name];
				field.fk = 1;
				field.fk_table = r.fk_table;
			});

			log.trace({ schema: JSON.stringify(schemaProps) }, '...Database.readSchema()');

			me.setSchema(schemaProps);
			cbAfter();

		}).catch(err => {
			log.error({err: err}, "Database.readSchema() query exception.");
			cbAfter(err);
		});

	} catch(err) {
		log.error({err: err}, "Database.readSchema() exception.");
		cbAfter(err);
	}
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

		var table = this.table(tableName);
		if ( ! _.isArray(rows)) throw new Error("rows type mismatch");

		if (rows.length == 0) {
			cbResult(null, []);
			return;
		}

		var fieldNames = _.filter(_.keys(rows[0]), function(fn) { 
			//filter out any non-field key
			return _.has(table.fields(), fn); // && fn != 'id'; 
		});

		var autoId = ! _.contains(fieldNames, 'id');

		fieldNames = _.union(fieldNames, 
					_.without(_.pluck(Table.MANDATORY_FIELDS, 'name'), 'id'));

		var add_by = options.user ? options.user.name : 'unk';
		var mod_by = add_by;

		var transaction = new mssql.Transaction(this.conn());
		var stmt = new mssql.PreparedStatement(transaction);

		_.each(fieldNames, function(fn) {
			var field = table.field(fn);
			var sqlType = SqlHelper.mssqlType(Field.typeName(field.type));
			stmt.input(fn, sqlType);
		});

		stmt.output('__id__', mssql.Int);

		var rowIds = [];
		var sql;

		transaction.begin().then(() => {
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
					log.trace(JSON.stringify(prevResult) + ' res insert');
					rowIds.push(prevResult.output.__id__);
				}

				if (row) {	

					row.add_on = row.mod_on = Field.dateToString(new Date());
					row.add_by = row.mod_by = mod_by;
					row.own_by = row.own_by || mod_by;

					var values = me.getFieldValues(row, table, fieldNames);
					log.trace({values: values}, 'insert row');
					if (values.err) return Promise.reject(new Error(values.err));
					var valObj = _.object(fieldNames, values.values);	
					return stmt.execute(valObj);					
				} 

				return Promise.resolve();		
			};
		
			log.trace('stmt prepare');
			var promiseRows = _.reduce(rows, function(promiseRows, row) {
				return promiseRows.then(result => {
					return doInsert(row, result);
				});	
			}, Promise.resolve());	

			return promiseRows.then(result => {
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

		if (rows.length == 0) {
			cbResult(null, []);
			return;
		}

		var table = this.table(tableName);
		if ( ! _.isArray(rows)) throw new Error("rows type mismatch");

		cbResult = cbResult || arguments[arguments.length - 1];	
		options = typeof options == 'object' ? options : {};		

		var returnModifiedRows = options.retmod || false;

		var fieldNames = _.intersection(_.keys(rows[0]), 
							_.keys(table.fields()));

		fieldNames = _.without(fieldNames, 'id', 'add_by', 'add_on');
		fieldNames = _.union(fieldNames, ['mod_on', 'mod_by']);

		var mod_by = options.user ? options.user.name : 'unk';

		var transaction = new mssql.Transaction(this.conn());
		var stmt = new mssql.PreparedStatement(transaction);

		_.each(fieldNames, function(fn) {
			var field = table.field(fn);
			var sqlType = SqlHelper.mssqlType(Field.typeName(field.type));
			stmt.input(fn, sqlType);
		});

		stmt.input('id', SqlHelper.mssqlType('integer'));

		var modCount = 0;	

		transaction.begin().then(() => {
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

					var values = me.getFieldValues(row, table, fieldNames);
					if (values.err) return Promise.reject(new Error(values.err));
					var valObj = _.object(fieldNames, values.values);	
					valObj['id'] = row.id;
					log.trace({values: valObj}, 'doUpdate values');

					return stmt.execute(valObj);				
				}

				return Promise.resolve();		
			};	

			var promiseRows = _.reduce(rows, function(promiseRows, row) {
				return promiseRows.then(result => {
					return doUpdate(row, result);
				});	
			}, Promise.resolve());

			return promiseRows.then(result => {
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

		var transaction = new mssql.Transaction(this.conn());
		var stmt = new mssql.PreparedStatement(transaction);

		var paramNames = [];
		_.each(rowIds, function(id) {
			var param = 'id' + id;
			stmt.input(param, SqlHelper.mssqlType('integer'));
			paramNames.push(param);
		});

		var delCount = 0;

		transaction.begin().then(() => {
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

		var transaction = new mssql.Transaction(this.conn());
		var stmt = new mssql.PreparedStatement(transaction);

		var chownCount = 0;

		transaction.begin().then(() => {

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

			var promiseQueries = Promise.resolve();	

			var chownTables = [ table ];
			while(chownTables.length > 0) {
				let t = chownTables.shift(); //only let (not var) will work here!
				var childTables = me.schema.graph.childTables(t);
				chownTables = chownTables.concat(childTables);
				
				promiseQueries = promiseQueries.then(result => {
					return doChown(t, result);
				});
			}

			return promiseQueries.then(result => {
				return doChown(null, result);
			});

/*
			var promiseRows = _.reduce(rows, function(promiseRows, row) {
				return promiseRows.then(result => {
					return doUpdate(row, result);
				});	
			}, Promise.resolve());
*/

		}).then(() => {
			return transaction.commit();

		}).then(() => {
			cbResult(null, { rowCount: chownCount }); 

		}).catch(err => {
			log.error({err: err}, "Database.chown() failed.");

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
		var dbTemp = tmp.tmpNameSync({template: 'tmp#XXXXXX'});

		var config = _.clone(this.config);
		config.database = 'master'; //connect to master

		var transaction;	

		var conn = new mssql.ConnectionPool(config);
		conn.connect().then(err => {

			var sql = util.format('CREATE DATABASE [%s]', dbTemp);
			conn.request().batch(sql).then(err => {
				log.trace('then transaction begin');
				transaction = new mssql.Transaction(conn);
				return transaction.begin();

			}).then(result => {
				log.trace('then create objs');
				var opts = { exclude: { viewSQL: true, searchSQL: true }};
				var createSQL = this.sqlBuilder.createSQL(this.schema, opts);
				var useSQL = util.format('USE [%s]\n', dbTemp);	
				return new Request(transaction).batch(useSQL + createSQL);

			}).then(result => {
				log.trace('then all views');
				var viewSQLs = _.map(this.schema.tables(), function(table) {
					return this.sqlBuilder.createRowAliasViewSQL(table); 	
				}, this);
				var createViews = _.reduce(viewSQLs, function(createViews, sql) {
					return createViews.then(result => {
						log.trace('create view');
						return new Request(transaction).batch(sql);	
					});	
				}, Promise.resolve());	
				return createViews;

			}).then(result => {	
				log.trace('then drop');
				return new Request(transaction).batch(SqlHelper.Schema.dropSQL(this.config.database));

			}).then(result => {
				log.trace('then commit');
				return transaction.commit();

			}).then(result => {
				log.trace('then rename');
				var sql = util.format('ALTER DATABASE [%s] Modify Name = [%s];'
							, dbTemp, this.config.database);	
				return conn.request().batch(sql);

			}).then(result => {
				conn.close();

				this.connect(err => {
					log.trace('Database.writeSchema()');
					cbAfter();
				});	

			}).catch(err => {
				log.error({err: err}, "Database.writeSchema() exception.");
				transaction.rollback().then(() => {
					conn.close();
					DatabaseMssql.remove(config, dbTemp, function() { cbAfter(err); });	
				}).catch(err => {
					log.error({err: err}, "Database.writeSchema() remove exception.");
					cbAfter(err); 
				});
			});	

		}).catch(err => {
			log.error({err: err}, "Database.writeSchema() connection exception.");
			cbAfter(err);
		});	

	} catch(err) {
		log.error({err: err}, "Database.writeSchema() exception.");
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
