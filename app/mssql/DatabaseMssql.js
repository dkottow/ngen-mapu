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
	this.config = config;

	Database.call(this);
}

DatabaseMssql.prototype = Object.create(Database.prototype);	

DatabaseMssql.prototype.getCounts = function(cbResult) {
	log.trace("Database.getCounts()...");
	try {

		var counts = {};

		if (_.size(this.tables()) == 0) {
			cbResult(null, counts);
			return;
		}

		mssql.connect(this.config).then(pool => {

			//get row counts
			var sql = _.map(_.keys(this.tables()), function(tn) {
				return 'SELECT ' + "'" + tn + "'" + ' AS table_name' 
						+ ', COUNT(*) AS count'
						+ ' FROM "' + tn + '"';
			});
			sql = sql.join(' UNION ALL ');
			//console.dir(sql);

			pool.request().query(sql).then(result => {
				//console.dir(result.recordset);

				_.each(result.recordset, function(r) {
					counts[r.table_name] = r.count;	
				});

			}).then(result => {

				mssql.close();
				cbResult(null, counts);

			}).catch(err => {
				log.error({err: err}, "Database.getCounts() query exception.");
				mssql.close();	
				cbResult(err, null);
			});

		}).catch(err => {
			log.error({err: err}, "Database.getCounts() connect exception.");
			cbResult(err, null);
		});

	} catch(err) {
		log.error({err: err}, "Database.getCounts() exception. ");	
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
		
		mssql.connect(this.config).then(pool => {

			var fields = _.map(Schema.TABLE_FIELDS, function(f) {
				return '"' + f + '"';
			});

			//read schema properties 
			var sql = 'SELECT ' + fields.join(',') 
					+ ' FROM ' + Schema.TABLE;

			pool.request().query(sql).then(result => {
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

				return pool.request().query(sql);

			}).then(result => {
				//console.dir(result.recordset);

				//handle empty schema
				if (result.recordset.length == 0) {
					me.setSchema(schemaProps);
					mssql.close();
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

				return pool.request().query(sql);

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

				return pool.request().query(sql);
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

				return pool.request().query(sql);

			}).then(result => {
				//console.log(result.recordset);

				_.each(result.recordset, function(r) {
					var field = schemaProps.tables[r.table_name].fields[r.column_name];
					field.fk = 1;
					field.fk_table = r.fk_table;
				});

				return result;

			}).then(result => {
				console.log(JSON.stringify(schemaProps));

				mssql.close();
				me.setSchema(schemaProps);
				cbAfter();

			}).catch(err => {
				log.error({err: err}, "Database.readSchema() query exception.");
				mssql.close();	
				cbAfter(err);
			});

		}).catch(err => {
			log.error({err: err}, "Database.readSchema() connect exception.");
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

		var opts = { exclude: { viewSQL: true, searchSQL: true }};
		var createSQL = this.sqlBuilder.createSQL(this.schema, opts);

		var viewSQLs = _.map(this.schema.tables(), function(table) {
			return this.sqlBuilder.createRowAliasViewSQL(table); 	
		}, this);

		var dbTemp = tmp.tmpNameSync({template: 'tmp#XXXXXX'});

		var config = _.clone(this.config);
		config.database = 'master'; //connect to master

		var transaction;	

		mssql.connect(config).then(pool => {
console.log('then create db');
			var sql = util.format('CREATE DATABASE [%s]', dbTemp);		
			return new Request().batch(sql);

		}).then(() => {
console.log('then transaction begin');
			transaction = new mssql.Transaction();
			return transaction.begin();

		}).then(result => {
console.log('then create objs');
			var useSQL = util.format('USE [%s]\n', dbTemp);	
			return new Request(transaction).batch(useSQL + createSQL);

		}).then(result => {
console.log('then all views');
			var createViews = _.reduce(viewSQLs, function(createViews, sql) {
				return createViews.then(result => {
console.log('then view');
					return new Request(transaction).batch(sql);	
				});	
			}, Promise.resolve());	
			return createViews;

		}).then(result => {	
console.log('then drop');
			return new Request(transaction).batch(SqlHelper.Schema.dropSQL(this.config.database));

		}).then(result => {
console.log('then commit');
			return transaction.commit();

		}).then(result => {
console.log('then rename');
			var sql = util.format('ALTER DATABASE [%s] Modify Name = [%s]', dbTemp, this.config.database);	
			return new Request().batch(sql);

		}).then(result => {
console.log('then close');
			mssql.close();	
			cbAfter();

		}).catch(err => {
			log.error({err: err}, "Database.writeSchema() exception.");
	console.log('catch rollback');
			transaction.rollback().then(() => {
	console.log('then close');
				mssql.close();	
				DatabaseMssql.remove(config, dbTemp, function() { cbAfter(err); });	
			}).catch(err => {
	console.log('catch close');
				log.error({err: err}, "Database.writeSchema() drop exception.");
				mssql.close();	
				cbAfter(err); 
			});
		});	

		mssql.on('error', err => {
			log.error({err: err}, "Database.writeSchema() SQL error.");
			mssql.close();	
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
