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

var Schema = require('./Schema.js').Schema;
var SchemaChange = require('./SchemaChange.js').SchemaChange;


var log = require('./log.js').log;

global.row_max_count = global.row_max_count || 1000;

var Database = function(options) 
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

var parseFn = function(fieldType) {
	if (fieldType.indexOf('CHAR') >= 0) {
		return function(val) { return String(val); }
	} else if (fieldType.indexOf('NUMERIC') == 0) {
		return function(val) { return parseFloat(val); }
	} else if (fieldType == 'INTEGER') {
		return function(val) { return parseInt(val); }
	} else if (fieldType.indexOf('DATE') == 0) {
		return function(val) { 
			return Number.isFinite(Date.parse(val))
				? String(val) : NaN; 
		}
	}
	throw new Error('unkown type ' + fieldType);
}
		
Database.prototype.getFieldValues = function(row, table, fieldNames) {
	var err = null;
	var values = _.map(fieldNames, function(fn) { 
		var t = table.field(fn).type;
		var val = ( _.isNull(row[fn]) || _.isUndefined(row[fn]))
			? null : parseFn(t)(row[fn]);
		if (t.indexOf('CHAR') < 0 && Number.isNaN(val)) {
			err = new Error('Conversion failed for ' 
				+ row[fn] + ' [' + fn + ']');
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

		//obtains table row counts
		me.getInfo(function(err, schemaInfo) {
			if (err) {
				cbResult(err, null);
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
				cbResult(err, null);
				return;
			}

			//apply changes  
			patchedSchema.applyChanges(changes);

			//write patches to database
			me.writeSchemaChanges(changes, 
				function(err) {

				if (err) {
					log.error({err: err, changes: changes}, 
						"Database.patchSchema() failed.");

					cbResult(err, null);
					return;
				}

				//replace database schema by patched one 
				me.schema = patchedSchema;

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


exports.Database = Database;
