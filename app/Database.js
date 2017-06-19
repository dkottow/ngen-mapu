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

Database.prototype.name = function() { 
	return this.schema.name;
}

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

var parseFn = function(typeName) {
	if (typeName == 'text') {
		return function(val) { return String(val); }
	} else if (typeName == 'decimal') {
		return function(val) { return parseFloat(val); }
	} else if (typeName == 'integer') {
		return function(val) { return parseInt(val); }
	} else if (typeName == 'date' || typeName == 'timestamp') {
		return function(val) { 
			return Number.isFinite(Date.parse(val))
				? String(val) : NaN; //return NaN on error 
		}
	}
	throw new Error('unkown type ' + typeName);
}
		
Database.prototype.getFieldValues = function(row, table, fieldNames) {
	var err = null;
	var values = _.map(fieldNames, function(fn) { 
		var typeName = SqlHelper.typeName(table.field(fn).type);
		var val = ( _.isNull(row[fn]) || _.isUndefined(row[fn]))
			? null : parseFn(typeName)(row[fn]);
		if (typeName != 'text' && Number.isNaN(val)) {
			//parseFn returns NaN on parse error (fwded from parseInt, parseFloat)
			err = new Error("Conversion failed for '" 
				+ row[fn] + '" [' + fn + ']');
		}
		//console.log(val + ' ' + row[fn] + ' ' + fn + ' ' + t);
		return val; 
	});
	return { values: values, err: err };
}


Database.prototype.patchSchema = function(patches, cbResult) {
	try {
		log.debug({patches: patches}, 'Database.patchSchema()...');
		var me = this;

		function cbPatchError(err) {
			me.getInfo(function(errInfo, schemaInfo) {
				log.debug({schemaInfo: schemaInfo}, 'Database.patchSchema()');
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
log.info({ options: options }, 'allSanitizeOptions...');
	var result = typeof options == 'object' ? options : {};		

	result.filter = options.filter || [];
	result.fields = options.fields || Table.ALL_FIELDS; 
	result.order = options.order || [];
	result.limit = options.limit;
	result.format = options.format || 'json';

log.info({ options: result }, '...allSanitizeOptions');
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
		count: countRows[0].count,
		totalCount: countRows[1].count,
		query: query
	};

	var expectedCount = result.count - sql.sanitized.offset;
	if (rows.length < expectedCount) {
		result.nextOffset = sql.sanitized.offset + sql.sanitized.limit;
	}

	if (opts.debug) {
		result.sql = sql.query;
		result.sqlParams = sql.params;
	}		

	log.debug({result: result}, "...Database.allResult()");
	return result;
}

exports.Database = Database;
