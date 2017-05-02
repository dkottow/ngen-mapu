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


DatabaseMssql.prototype.readSchema = function(cbAfter) {
	var me = this;

	try {
		log.debug({db: this.config.database}, "Schema.read()");

		mssql.connect(this.config).then(pool => {

			var fields = _.map(Schema.TABLE_FIELDS, function(f) {
				return '"' + f + '"';
			});
			var sql = 'SELECT ' + fields.join(',') 
					+ ' FROM ' + Schema.TABLE;

			//read schema properties 
			pool.request().query(sql).then(result => {

				var schemaProps = {
					name: this.config.database
				};
				
				_.each(result.recordset, function(r) {
					schemaProps[r.name] = JSON.parse(r.value);
				});

				var fields = _.map(Table.TABLE_FIELDS, function(f) {
					return '"' + f + '"';
				});

				var sql = 'SELECT ' + fields.join(',') 
						+ ' FROM ' + Table.TABLE;

				//read table properties 
				return pool.request().query(sql);

			}).then(result => {

				console.dir(result);	

			}).then(result => {
				mssql.close();
				cbAfter();

			}).catch(err => {
				log.error({err: err}, "Database.readSchema() batch exception.");
				mssql.close();	
				cbAfter(err);
			});

		}).catch(err => {
			log.error({err: err}, "Database.readSchema() connect exception.");
			cbAfter(err);
		})

	} catch(err) {
		log.error({err: err}, "Schema.read() exception.");
		cbAfter(err);
	}
}


/*
		var db = new sqlite3.Database(me.dbFile
							, sqlite3.OPEN_READONLY
							, function(err) {
			if (err) {
				log.error({err: err, file: me.dbFile}, 
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

				var schemaProps = {
					name: DatabaseSqlite.getName(me.dbFile)
				};
				
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
							me.setSchema(schemaProps);
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

								me.setSchema(data);
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
*/



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
