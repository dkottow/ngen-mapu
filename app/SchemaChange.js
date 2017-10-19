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

var jsonpatch = require('fast-json-patch');

var log = require('./log.js').log;
var Table = require('./Table.js').Table;
var Field = require('./Field.js').Field;

var SqlHelper = require('./SqlHelperFactory.js').SqlHelperFactory.create();
var SchemaDefs = require('./SchemaDefs.js').SchemaDefs;

var SchemaChange = function(patch, schema) {
	this.schema = schema;
}

SchemaChange.OPS = {
	  ADD_TABLE: 'add_table'
	, ADD_FIELD: 'add_field'

	//only for empty tables
	, SET_TABLE: 'set_table'
	, DEL_TABLE: 'del_table'

	//non-structural	
	, SET_ROW_ALIAS: 'set_row_alias'
};

SchemaChange._create = function(patch, schema) {

	this.schema = schema;

	//determine if patch acts on (non)empty table
	var isEmpty = false;
	var match = patch.path.match(/^\/tables\/(\w+)/);
	if (match) {
		var table = schema.table(match[1]);
		if (table && table.props.row_count == 0) {
			isEmpty = true;	
		}
		log.debug({table: match[1], isempty: isEmpty}, 'SchemaChange._create()');
	}

	var result;
	//ordering is important, test more specific paths first

	if 	(  /^\/join_trees\//.test(patch)
		|| /^\/tables\/(\w+)\/row_count/.test(patch)	
		) 
	{
		//ignore
		log.debug({patch: patch, SchemaChange: null}, 'SchemaChange._create()');
		return null;

	} else if (SCTableRowAlias.test(patch)) {
		result = new SCTableRowAlias(patch, schema);

	} else if (SCAddTable.test(patch)) {
		result = new SCAddTable(patch, schema);

/* 
//sometimes when tables are empty, setTable will fail to do changes
//on mssql because of fk's pointing to it.
//TODO explore option to use add/del field instead.

	} else if (SCAddField.test(patch)) {
		result = new SCAddField(patch, schema);

	} else if (isEmpty && SCDelField.test(patch)) {
		result = new SCDelField(patch, schema);
*/
	} else if (isEmpty && SCSetTable.test(patch)) {
		result = new SCSetTable(patch, schema);

	} else if (isEmpty && SCDelTable.test(patch)) {
		result = new SCDelTable(patch, schema);

	} else if (! isEmpty && SCAddField.test(patch)) {
		result = new SCAddField(patch, schema);
	}

	if (result) {
		log.debug({patch: patch, SchemaChange: result.constructor.name, op: result.op, path: result.path}, 'SchemaChange._create()');
		return result;
	}	

	log.warn({patch: patch, empty: isEmpty}, 'No patch found. Schema._create()');
	if (isEmpty) throw new Error('Unsupported patch');
	else throw new Error("Unsupported patch for non-empty table");
} 


SchemaChange.create = function(patches, schema) {
	log.trace({patches: patches}, 'SchemaChange.create()...');

	var patchSequences = {}; //sequence of changes of same type

	 _.each(patches, function(patch) {
	
		var change = SchemaChange._create(patch, schema);
		if (change) {
			patch.path = change.patchPath();

			var key = change.key();
			patchSequences[key] = patchSequences[key] || [];
			patchSequences[key].push({
				patch: patch,
				change: change
			});						
		}

	}, this);
	
	var changes = [];
	_.each(patchSequences, function(seq) {			
		var change = seq[0].change;
		if (change.patchObj) {
			var patches = _.pluck(seq, 'patch');
			jsonpatch.apply(change.patchObj, patches);
		}
		changes.push(change);
	});
	
	return changes;
}

SchemaChange.prototype.key = function() {
	return this.op + this.path;	
}

SchemaChange.prototype.patchPath = function() {
	return this.patch_path;	
}

SchemaChange.prototype.afterSQL = function(sqlBuilder) {
	return []; //nothing
}

SchemaChange.prototype.insertRows = function() {
	return []; //nothing
}

/**** SchemaChange ops *****/ 

var SCAddField = function(patch, schema) {
	log.trace({patch: patch}, "SchemaChange.SCAddField()");
	SchemaChange.call(this, patch, schema);
	this.op = SchemaChange.OPS.ADD_FIELD;
	
	var pathArray = patch.path.split('/');
	pathArray.shift(); // leading slash,
	pathArray.shift(); // 'tables' keyword
	this.table = this.schema.table(pathArray.shift());
	pathArray.shift(); // 'field' keyword
	this.path = '/' + this.table.name + '/' + pathArray.shift();
	this.patchObj = null; //no json patches
	this.changeObj = patch.value;
}


SCAddField.prototype = new SchemaChange;	
SCAddField.prototype.constructor = SCAddField;

SCAddField.test = function(patch) {
	return (patch.op == 'add' 
		&& /^\/tables\/(\w+)\/fields\/(\w+)$/.test(patch.path)); 
}

SCAddField.prototype.apply = function() {
	var field = new Field(this.changeObj);
	this.table.addField(field);	
}

SCAddField.prototype.toSQL = function(sqlBuilder) {
	var field = this.table.field(this.changeObj.name);

	var sqlBatches = [];

	sqlBatches.push(this.table.addFieldSQL(field));
	sqlBatches.push(this.table.dropViewSQL());
	sqlBatches.push(sqlBuilder.createRowAliasViewSQL(this.table));

	if (SqlHelper.Table.hasTriggers()) {
		sqlBatches.push(SqlHelper.Table.dropTriggerSQL(this.table));		
		sqlBatches.push(SqlHelper.Table.createTriggerSQL(this.table));		
	}

	//sqlBatches.push(field.insertPropSQL(this.table));
	
	return sqlBatches;
}

SCAddField.prototype.insertRows = function() {
	var field = this.table.field(this.changeObj.name);
	return {
		table: SchemaDefs.PROPERTIES_TABLE,
		rows: field.systemPropertyRows(this.table)
	};
}


/*
var SCDelField = function(patch, schema) {
	log.trace({patch: patch}, "SchemaChange.SCDelField()");
	SchemaChange.call(this, patch, schema);
	this.op = SchemaChange.OPS.DEL_FIELD;
	
	var pathArray = patch.path.split('/');
	pathArray.shift(); // leading slash,
	pathArray.shift(); // 'tables' keyword
	this.table = this.schema.table(pathArray.shift());
	pathArray.shift(); // 'field' keyword
	this.field = this.table.field(pathArray.shift());
	this.path = '/' + this.table.name + '/' + this.field.name;
}

SCDelField.prototype = new SchemaChange;	
SCDelField.prototype.constructor = SCDelField;

SCDelField.test = function(patch) {
	return (patch.op == 'remove' 
		&& /^\/tables\/(\w+)\/fields\/(\w+)$/.test(patch.path)); 
}


/*
 * add table. 
 * 
 * patch op is add and path is /tables/<name>
 *
 */

var SCAddTable = function(patch, schema) {
	log.trace({patch: patch}, "SchemaChange.SCAddTable()");
	SchemaChange.call(this, patch, schema);
	this.op = SchemaChange.OPS.ADD_TABLE;
	
	var pathArray = patch.path.split('/');
	pathArray.shift(); // leading slash,
	pathArray.shift(); // 'tables' keyword
	this.path = '/' + pathArray.shift();
	this.patchObj = null; //no json patches
	this.changeObj = patch.value;
}

SCAddTable.prototype = new SchemaChange;	
SCAddTable.prototype.constructor = SCAddTable;

SCAddTable.test = function(patch) {
	return (patch.op == 'add' && /^\/tables\/(\w+)$/.test(patch.path)); 
}

SCAddTable.prototype.apply = function() {
	var table = new Table(this.changeObj);
	this.schema.addTable(table);	
}

SCAddTable.prototype.toSQL = function(sqlBuilder) {	

	var sqlBatches = [];
	var table = this.schema.table(this.changeObj.name);

	sqlBatches.push(table.createSQL());
	sqlBatches.push(sqlBuilder.createRowAliasViewSQL(table));
	//sqlBatches.push(table.insertPropSQL({deep: true}));

	return sqlBatches;
}

SCAddTable.prototype.afterSQL = function(sqlBuilder) {	
	var sqlBatches = [];
	var table = this.schema.table(this.changeObj.name);
	var sql = SqlHelper.Table.createSearchSQL(table);
	if (sql.length > 0) sqlBatches.push(sql);
	return sqlBatches;
}

SCAddTable.prototype.insertRows = function() {
	var table = this.schema.table(this.changeObj.name);
	return {
		table: SchemaDefs.PROPERTIES_TABLE,
		rows: table.systemPropertyRows()
	};
}

/*
 * set table. 
 * drops and re-creates a table 
 * 
 * patch path must start with /tables/<name>/
 *
 */

var SCSetTable = function(patch, schema) {
	SchemaChange.call(this, patch, schema);
	this.op = SchemaChange.OPS.SET_TABLE;
	
	var pathArray = patch.path.split('/');
	pathArray.shift(); // leading slash,
	pathArray.shift(); // 'tables' keyword
	var table = this.schema.table(pathArray.shift());
	this.patch_path = '/' + pathArray.join('/');
	this.path = '/' + table.name;
	this.patchObj = table.toJSON(); 
}

SCSetTable.prototype = new SchemaChange;	
SCSetTable.prototype.constructor = SCSetTable;

SCSetTable.test = function(patch) {
	return /^\/tables\/(\w+)\//.test(patch.path);	
}

SCSetTable.prototype.apply = function() {
	log.trace({table: this.patchObj}, 'SCSetTable.apply()');
	this.schema.setTable(new Table(this.patchObj));
}

SCSetTable.prototype.toSQL = function(sqlBuilder) {
	var table = this.schema.table(this.patchObj.name);

	var sql;
	var sqlBatches = [];

	sql = SqlHelper.Table.dropSearchSQL(table);
	if (sql.length > 0) sqlBatches.push(sql);

	sql = sqlBuilder.dropDependenciesSQL(table);
	if (sql.length > 0) sqlBatches.push(sql);

	sqlBatches.push(table.dropViewSQL());
	sqlBatches.push(table.dropSQL());
	sqlBatches.push(table.deletePropSQL());
	
	sqlBatches.push(table.createSQL());
	sqlBatches.push(sqlBuilder.createRowAliasViewSQL(table));

	sql = sqlBuilder.addDependenciesSQL(table);
	if (sql.length > 0) sqlBatches.push(sql);

	//TODO sqlBatches.push(table.insertPropSQL({deep: true}));

	return sqlBatches;
}

SCSetTable.prototype.afterSQL = function(sqlBuilder) {	
	var sqlBatches = [];
	var table = this.schema.table(this.patchObj.name);
	var sql = SqlHelper.Table.createSearchSQL(table);
	if (sql.length > 0) sqlBatches.push(sql);
	return sqlBatches;
}

SCSetTable.prototype.insertRows = function() {
	var table = this.schema.table(this.patchObj.name);
	return {
		table: SchemaDefs.PROPERTIES_TABLE,
		rows: table.systemPropertyRows()
	};
}

/*
 * del table. drops table.
 * 
 * patch op remove
 * patch path /tables/<name>
 *
 */

var SCDelTable = function(patch, schema) {
	log.trace({patch: patch}, "SchemaChange.SCDelTable()");
	SchemaChange.call(this, patch, schema);
	this.op = SchemaChange.OPS.DEL_TABLE;
	
	var pathArray = patch.path.split('/');
	pathArray.shift(); // leading slash,
	pathArray.shift(); // 'tables' keyword
	var table = this.schema.table(pathArray.shift());
	this.table = new Table(table.toJSON());
	this.path = '/' + this.table.name;
}

SCDelTable.prototype = new SchemaChange;	
SCDelTable.prototype.constructor = SCDelTable;

SCDelTable.test = function(patch) {
	log.trace({patch: patch});
	return (patch.op == 'remove' && /^\/tables\/(\w+)$/.test(patch.path)); 
}

SCDelTable.prototype.apply = function() {
	this.schema.removeTable(this.table.name);
}

SCDelTable.prototype.toSQL = function(sqlBuilder) {

	var sql;
	var sqlBatches = [];

	//sqlBatches.push(this.table.deletePropSQL({deep: true}));

	sql = SqlHelper.Table.dropSearchSQL(this.table);
	if (sql.length > 0) sqlBatches.push(sql);

	sql = sqlBuilder.dropDependenciesSQL(this.table);
	if (sql.length > 0) sqlBatches.push(sql);

	sqlBatches.push(this.table.dropViewSQL());
	sqlBatches.push(this.table.dropSQL());
	sqlBatches.push(this.table.deletePropSQL());
	
 	return sqlBatches;
}

/*
 * table row alias. path e.g. /tables/1/row_alias
 */

var SCTableRowAlias = function(patch, schema) {
	log.trace({patch: patch}, "SchemaChange.SCTableRowAlias()");
	SchemaChange.call(this, patch, schema);
	this.op = SchemaChange.OPS.SET_ROW_ALIAS;
	
	var pathArray = patch.path.split('/');
	pathArray.shift(); // leading slash,
	pathArray.shift(); // 'tables' keyword
	this.table = this.schema.table(pathArray.shift());
	pathArray.shift(); // 'row_alias' keyword
	this.patch_path = '/' + pathArray.join('/');
	this.path = '/' + this.table.name + '/row_alias';
	this.patchObj = JSON.parse(JSON.stringify(this.table.row_alias)); //hold a copy
}

SCTableRowAlias.prototype = new SchemaChange;	
SCTableRowAlias.prototype.constructor = SCTableRowAlias;

SCTableRowAlias.test = function(patch) {
	return /^\/tables\/(\w+)\/row_alias/.test(patch.path);	
}

SCTableRowAlias.prototype.apply = function() {
	this.table.row_alias = this.patchObj;
}

SCTableRowAlias.prototype.toSQL = function(sqlBuilder) {
	var sqlBatches = [];

	sqlBatches.push(this.table.dropViewSQL());
	sqlBatches.push(sqlBuilder.createRowAliasViewSQL(this.table));

	if (SqlHelper.Table.hasTriggers()) {
		sqlBatches.push(SqlHelper.Table.dropTriggerSQL(this.table));
		sqlBatches.push(SqlHelper.Table.createTriggerSQL(this.table));
	}

	var sql = util.format("DELETE FROM %s WHERE %s = '%s' AND %s = 'row_alias'", 
		SchemaDefs.PROPERTIES_TABLE,
		SchemaDefs.PROPERTIES_FIELDS.table,
		this.name,
		SchemaDefs.PROPERTIES_FIELDS.name
	);
	sqlBatches.push(sql);
	
	return sqlBatches;
}

SCTableRowAlias.prototype.insertRows = function() {
	var row = {};

	row[SchemaDefs.PROPERTIES_FIELDS.name] = 'row_alias';
	row[SchemaDefs.PROPERTIES_FIELDS.table] = this.table.name;
	row[SchemaDefs.PROPERTIES_FIELDS.value] = JSON.stringify(this.table.row_alias);
	
	return {
		table: SchemaDefs.PROPERTIES_TABLE,
		rows: [ row ] 
	};
}

exports.SchemaChange = SchemaChange;

