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

		_.each(sql.params, function(param) {
			var typeName = Field.typeName(param.type);
			req.input(param.name, SqlHelper.mssqlType(typeName), param.value);
		});

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


DatabaseMssql.prototype.all = function(tableName, options, cbResult) {

	log.trace("Database.all()...");
	try {

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
		//log.warn({sql: sql.params}, "Database.all()");

		var req = this.conn().request();

		_.each(sql.params, function(param) {
			var typeName = Field.typeName(param.type);
			req.input(param.name, SqlHelper.mssqlType(typeName), param.value);
		});

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

DatabaseMssql.prototype.get = function(tableName, options, cbResult) {

	try {

		var table = this.table(tableName);

		cbResult = cbResult || arguments[arguments.length - 1];	
		options = typeof options == 'object' ? options : {};		

		var filterClauses = options.filter || [];
		var fields = options.fields || Table.ALL_FIELDS; 

		var sql = this.sqlBuilder.selectSQL(table, fields, filterClauses, [], 1, 0, false);

		var req = this.conn().request();

		_.each(sql.params, function(param) {
			var typeName = Field.typeName(param.type);
			req.input(param.name, SqlHelper.mssqlType(typeName), param.value);
		});

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

			log.info({ schema: JSON.stringify(schemaProps) }, '...Database.readSchema()');

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

DatabaseMssql.prototype.writeSchema = function(cbAfter) {
	var me = this;
	try {

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
					log.error({err: err}, "Database.writeSchema() drop exception.");
					cbAfter(err); 
				});
			});	

		}).catch(err => {
			log.error({err: err}, "Database.writeSchema() connection exception.");
			cbAfter(err);
		});	

	} catch(err) {
	console.log('catch ex');
		log.error({err: err}, "Database.writeSchema() exception.");
		cbAfter(err);
	}
}

DatabaseMssql.remove = function(dbConfig, dbName, cbAfter) {
	try {
		log.info({dbConfig: dbConfig, dbName: dbName }, 'DatabaseMssql.remove..');

		var config = _.clone(dbConfig);
		config.database = 'master'; //connect to master

		mssql.connect(config).then(pool => {
			return new Request().batch(SqlHelper.Schema.dropSQL(dbName));
		
		}).then(result => {
			mssql.close();	
			cbAfter(); 	

		}).catch(err => {
			log.error({err: err}, "Database.remove() batch exception.");
			mssql.close();	
			cbAfter(err);
			return;
		});

		mssql.on('error', err => {
			log.error({err: err}, "Database.remove() SQL error.");
			mssql.close();	
			cbAfter(err);
		});

	} catch(err) {
		log.error({err: err}, "Database.remove() exception.");
		cbAfter(err);
	}
}

exports.DatabaseMssql = DatabaseMssql;
