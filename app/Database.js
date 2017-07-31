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

var _ = require('underscore');

var util = require('util');
var Papa = require('papaparse');

var Table = require('./Table.js').Table;
var Schema = require('./Schema.js').Schema;
var SchemaChange = require('./SchemaChange.js').SchemaChange;

var SqlHelper = require('./SqlHelperFactory.js').SqlHelperFactory.create();
var SqlBuilderFactory = require('./SqlBuilderFactory.js').SqlBuilderFactory;

var config = require('config'); 
var log = require('./log.js').log;

var Database = function() 
{
	log.trace('new Database');
	this.schema = new Schema();
}

/*	

Database.prototype.init = function(cbAfter) {
}

*/

Database.prototype.init = function() {
	var me = this;
	return new Promise(function(resolve, reject) {
		me._init(function(err) {
			if (err) reject(err);
			else resolve(); 
		});
	});
}

Database.prototype.initInfo = function() {
	return { at: this._initAt };
}

Database.prototype._init = function(cbAfter) {
	var me = this;
	if (me.schema.isEmpty()) {
		if ( ! me._readingSchema) {
			me.readSchema(function(err) {
				me._initAt = new Date();
				cbAfter(err);
			});
		} else {
			console.log('timeout Database.init()');
			setTimeout(function() {
				if (me.schema.isEmpty()) {
					cbAfter(new Error('init failed.'), null);
				} else {
					return cbAfter();
				}
			}, config.sql.initRetryInterval);
		}
		
	} else {
		cbAfter();
	}
}

Database.prototype.reset = function() {
	this.schema = new Schema(); //empty schema
	return this.init();
}

/* 
Database.prototype.name = function() { 
	return this.schema.name;
}
*/

Database.prototype.table = function(name) { 
	return this.schema.table(name);
}

Database.prototype.user = function(name) { 
	return this.schema.user(name);
}

Database.prototype.tables = function() { 
	return this.schema.tables();
};

Database.prototype.users = function() { 
	var users = this.schema.users;
	return _.object(_.pluck(users, 'name'), users); 
}

Database.prototype.childTables = function(tableName) {
	return this.schema.graph.childTables(tableName);
}

Database.prototype.rowsToObj = function(rows, tableName) {
	return this.schema.graph.rowsToObj(rows, tableName);
}

Database.prototype.setSchema = function(newSchema) {

	if (newSchema instanceof Schema) {
		this.schema = newSchema;
	} else {
		//expecting a json rep of the schema 
		this.schema.init(newSchema);
	}

	this.sqlBuilder = SqlBuilderFactory.create(this.schema.graph);
}

Database.prototype.getInfo = function(options, cbResult) {

	cbResult = cbResult || arguments[arguments.length - 1];	
	options = typeof options == 'object' ? options : {};		

	var skipCounts = options.skipCounts || false;

	var result = this.schema.get();

	if (skipCounts) {
		cbResult(null, result);
		return;
	}
	
	this.getCounts(function(err, counts) {
		if (err) {
			cbResult(err, null);
		} else {
			_.each(result.tables, function(table) {
				table.row_count = counts[table.name];
			});
			cbResult(null, result);
		}
	});
}

Database.prototype.isEmpty = function(cbResult) {
	this.getCounts(function(err, result) {
		if (err) {
			cbResult(err, null);
			return;	
		}
		
		var totalRowCount = _.reduce(result, 
			function(memo, tableRowCount) { 
				return memo + tableRowCount; 
			}, 
		0);

		cbResult(null, totalRowCount == 0);
	});
}

Database.prototype.allById = function(tableName, rowIds, options, cbResult) {

	cbResult = cbResult || arguments[arguments.length - 1];	
	options = typeof options == 'object' ? options : {};		

	options.filter = options.filter || [];

	options.filter.push({
		field: 'id',
		op: 'in',
		value: rowIds
	});
	
	return this.all(tableName, options, cbResult);
} 

Database.prototype.rowsOwned = function(tableName, rowIds, user, cbResult) {
	log.trace({table: tableName, user: user}, 'Database.rowsOwned()...');
	log.trace({rowIds: rowIds},  'Database.rowsOwned()');
	
	var fields = ['id', 'own_by'];
	this.allById(tableName, rowIds, { fields: fields }, function(err, result) {
		if (err) {
			cbResult(err, null);
			return;
		}
		var notOwned = _.find(result.rows, function(row) {
			return row.own_by != user.name;	
		});

		log.trace({notOwned: notOwned}, '...Database.rowsOwned()');
		cbResult(null,  ! notOwned);	
	});
}

Database.prototype.getInsertFields = function(rows, table) {

	var row = rows[0]; //all based on first row

	var rejectFields = _.pluck(_.filter(Table.MANDATORY_FIELDS, function(mf) { 
		if (mf.name == 'id' && ! _.isNumber(row.id)) return true;
		return false; 
	}), 'name');

	var forceFields = _.pluck(_.filter(Table.MANDATORY_FIELDS, function(mf) { 
		return _.contains(['add_by', 'add_on', 'mod_by', 'mod_on'], mf.name); 
	}), 'name');

	var fields = _.filter(table.fields(), function(field) {
		if (_.contains(rejectFields, field.name)) {
			//never insert these fields, even if present in row
			return false; 
		}
		if (_.contains(forceFields, field.name)) {
			//always insert these fields, regardless of present in row
			return true;
		}
		if (row[field.name]) {
			//insert if present row
			return true;
		}
		
		return false;
	});

	return _.object(_.pluck(fields, 'name'), fields);
}

Database.prototype.getUpdateFields = function(rows, table) {

	var rejectFields = _.pluck(_.filter(Table.MANDATORY_FIELDS, function(mf) { 
		return _.contains(['id', 'add_by', 'add_on'], mf.name); 
	}), 'name');

	var forceFields = _.pluck(_.filter(Table.MANDATORY_FIELDS, function(mf) { 
		return _.contains(['mod_by', 'mod_on'], mf.name); 
	}), 'name');

	var row = rows[0]; //all based on first row

	var fields = _.filter(table.fields(), function(field) {
		if (_.contains(rejectFields, field.name)) {
			//never update these fields, even if present in row
			return false; 
		}
		if (_.contains(forceFields, field.name)) {
			//always update these fields, regardless of present in row
			return true;
		}
		if (row[field.name]) {
			//update if present row
			return true;
		}
		
		return false;
	});
	
	return _.object(_.pluck(fields, 'name'), fields);
}

Database.prototype.getFieldValues = function(row, fields) {
	try {
		var values = _.map(fields, function(field) {
			var val = field.parse(row[field.name]);
			if (val !== val) { 
				//v is NaN
				throw new Error("field.parse() failed. for " + field.name + " = '" + row[field.name] + "' [" + row.id + "]");
			}
			return val;
		});
		return { values: values };

	} catch(err) {
		return { err: err };
	}
}

Database.prototype.createSQL = function(opts) {
	return this.sqlBuilder.createSQL(this.schema, opts);
}

Database.prototype.patchSchema = function(patches, cbResult) {
	try {
		log.debug({patches: patches}, 'Database.patchSchema()...');
		var me = this;

		function cbPatchError(err) {
			me.getInfo(function(errInfo, schemaInfo) {
				log.trace({schemaInfo: schemaInfo}, 'Database.patchSchema()');
				if (errInfo) throw new Error('Error trying to obtain getInfo');
				cbResult(err, schemaInfo);
			});									
		}

		//obtains table row counts
		me.getInfo(function(err, schemaInfo) {
			if (err) {
				cbPatchError(err);
				return;
			}
	
			//take a schema copy 
			var patchedSchema = new Schema();
			patchedSchema.init(schemaInfo);

			//decorate table with row_count prop
			_.each(schemaInfo.tables, function(table) {
				patchedSchema.table(table.name)
					.setProp('row_count', table.row_count);
			});

			try {
				var changes = SchemaChange.create(patches, patchedSchema);
			} catch (err) {
				log.warn({err: err, patches: patches}, 
					"SchemaChange.create() failed. Unsupported patches");
				cbPatchError(err);
				return;
			}

			//apply changes  
			patchedSchema.applyChanges(changes);

			//write patches to database
			me.writeSchemaChanges(changes, function(err) {

				if (err) {
					log.error({err: err}, "Database.patchSchema() failed.");
					//TODO read from disk?
					cbPatchError(err);
					return;
				}

				//replace database schema by patched one 
				me.setSchema(patchedSchema);

				//return patched schema info (use getInfo to return rowCounts)
				me.getInfo(cbResult);
			});

		});

	} catch(err) {
		log.error({err: err, patches: patches}, 
			"Database.patchSchema() exception.");	

		cbResult(err, null);
	}
}

Database.prototype.allSanitizeOptions = function(options) {
	log.trace({ options: options }, 'Database.allSanitizeOptions()...');
	var result = {};		

	result.filter = options.filter || [];
	result.fields = options.fields || Table.ALL_FIELDS; 
	result.order = options.order || [];
	result.limit = options.limit;
	result.offset = options.offset;
	result.debug = options.debug || false;
	result.format = options.format || 'json';
	result.nocounts = options.nocounts || false;
	log.trace({ result: result }, '...Database.allSanitizeOptions()');
	return result;
}

Database.prototype.allSQL = function(tableName, options) {

	var opts = this.allSanitizeOptions(options);
	var table = this.table(tableName);

	log.trace(opts.fields + " from " + table.name 
			+ " filtered by " + util.inspect(opts.filter));

	var sql = this.sqlBuilder.selectSQL(
				table, opts.fields, opts.filter, 
				opts.order, opts.limit, opts.offset);

	sql.nocounts = opts.nocounts;

	log.debug({sql: sql.query}, "Database.allSQL()");
	log.trace({sql: sql}, "Database.allSQL()");

	return sql;	
}

Database.prototype.allResult = function(tableName, rows, countRows, sql, options) {

	var opts = this.allSanitizeOptions(options);		

	var query = {
		table : tableName
		, select: opts.fields
		, filter : opts.filter
		, orderby: opts.order
		, top: opts.limit
		, skip: opts.offset
		, format: opts.format 
	};


	if (opts.format == 'csv') {
		return Papa.unparse(rows);
	}	

	//json

	var result = { 
		rows: rows, 
		query: query
	};

	if (countRows && countRows.length) {
		result.count = countRows[0].count;
		result.totalCount = countRows[1].count;
		
		var expectedCount = result.count - sql.sanitized.offset;
		if (rows.length < expectedCount) {
			result.nextOffset = sql.sanitized.offset + sql.sanitized.limit;
		}
	}

	if (opts.debug) {
		result.sql = sql.query;
		result.sqlParams = sql.params;
		result.sqlTime = sql.secs;
	}		

	log.trace({result: result}, "...Database.allResult()");
	return result;
}

exports.Database = Database;
