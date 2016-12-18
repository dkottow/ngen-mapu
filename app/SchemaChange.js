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
var assert = require('assert');

var log = require('./log.js').log;
var Table = require('./Table.js').Table;
var Field = require('./Field.js').Field;

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
	, SET_PROP_TABLE: 'set_prop_table' 
	, SET_PROP_FIELD: 'set_prop_field' 
	, DISABLE_FIELD: 'disable_field'

	, SET_USER: 'set_user' 
	, SET_ACCESS_CONTROL: 'set_access_control'

};

SchemaChange.create = function(patch, schema) {

	//ordering is important, test more specific paths first

	var isEmpty = false;

	var match = patch.path.match(/^\/tables\/(\w+)/);
	if (match) {
		var table = schema.table(match[1]);
		if (table && table.props.row_count == 0) {
			isEmpty = true;		
		}
	}

	this.schema = schema;

	if (SCFieldProps.test(patch)) {
		return new SCFieldProps(patch, schema);
		
	} else if (SCDisableField.test(patch)) {
		return new SCDisableField(patch, schema);

	} else if (SCTableProps.test(patch)) {
		return new SCTableProps(patch, schema);

	} else if (SCTableAccess.test(patch)) {
		return new SCTableAccess(patch, schema);

	} else if (SCUsers.test(patch)) {
		return new SCUsers(patch, schema);
	
	} else if (SCAddTable.test(patch)) {
		return new SCAddTable(patch, schema);

	} else if (SCAddField.test(patch)) {
		return new SCAddField(patch, schema);

	} else if (isEmpty && SCSetTable.test(patch)) {
		return new SCSetTable(patch, schema);

	} else if (isEmpty && SCDelTable.test(patch)) {
		return new SCDelTable(patch, schema);
	}

	return null;	
} 

SchemaChange.prototype.key = function() {
	return this.op + this.path;	
}

SchemaChange.prototype.patchPath = function() {
	return this.patch_path;	
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
	this.obj = null; //no json patches
	this.fieldDef = patch.value;
}


SCAddField.prototype = new SchemaChange;	

SCAddField.test = function(patch) {
	return (patch.op == 'add' 
		&& /^\/tables\/(\w+)\/fields\/(\w+)$/.test(patch.path)); 
}

SCAddField.prototype.apply = function() {
	var field = new Field(this.fieldDef);
	this.table.addField(field);	
}

SCAddField.prototype.toSQL = function() {
	var field = this.table.field(this.fieldDef.name);
	var addSQL = this.table.addFieldSQL(field);
	var insertPropSQL = field.insertPropSQL(this.table);
	return addSQL + insertPropSQL;
}


/*
 * field properties. path e.g. /tables/customers/fields/name/props/order
 */

var SCFieldProps = function(patch, schema) {
	log.trace({patch: patch}, "SchemaChange.SCFieldProps()");
	SchemaChange.call(this, patch, schema);
	this.op = SchemaChange.OPS.SET_PROP_FIELD;
	
	var pathArray = patch.path.split('/');
	pathArray.shift(); // leading slash,
	pathArray.shift(); // 'tables' keyword
	this.table = this.schema.table(pathArray.shift());
	pathArray.shift(); // 'field' keyword
	this.field = this.table.field(pathArray.shift());
	pathArray.shift(); // 'props' keyword
	this.patch_path = '/' + pathArray.join('/');
	this.path = '/' + this.table.name + '/' + this.field.name + '/props';
	this.obj = JSON.parse(JSON.stringify(this.field.props)); //hold a copy
}


SCFieldProps.prototype = new SchemaChange;	

SCFieldProps.test = function(patch) {
	return /^\/tables\/(\w+)\/fields\/(\w+)\/props\//.test(patch.path);	
}

SCFieldProps.prototype.apply = function() {
	_.each(this.obj, function(v, k) {
		this.field.setProp(k, v); 
	}, this);
}

SCFieldProps.prototype.toSQL = function() {
	return this.field.updatePropSQL(this.table);
}


/*
 * disable field path e.g. /tables/3/fields/4/disabled
 */

var SCDisableField = function(patch, schema) {
	log.trace({patch: patch}, "SchemaChange.SCDisableField()");
	SchemaChange.call(this, patch, schema);
	this.op = SchemaChange.OPS.DISABLE_FIELD;
	
	var pathArray = patch.path.split('/');
	pathArray.shift(); // leading slash,
	pathArray.shift(); // 'tables' keyword
	this.table = this.schema.table(pathArray.shift());
	pathArray.shift(); // 'field' keyword
	this.field = this.table.field(pathArray.shift());
	this.patch_path = '/' + pathArray.join('/');
	this.path = '/' + this.table.name + '/' + this.field.name + '/disabled';
	this.obj = JSON.parse(JSON.stringify(this.field)); 
}


SCDisableField.prototype = new SchemaChange;	

SCDisableField.test = function(patch) {
	return /^\/tables\/(\w+)\/fields\/(\w+)\/disabled/.test(patch.path);	
}

SCDisableField.prototype.apply = function() {
	this.field.setDisabled(this.obj.disabled);
}

SCDisableField.prototype.toSQL = function() {
	return this.field.updatePropSQL(this.table);
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
	this.obj = null; //no json patches
	this.tableDef = patch.value;
}

SCAddTable.prototype = new SchemaChange;	

SCAddTable.test = function(patch) {
	return (patch.op == 'add' && /^\/tables\/(\w+)$/.test(patch.path)); 
}

SCAddTable.prototype.apply = function() {
	var table = new Table(this.tableDef);
	this.schema.addTable(table);	
}

SCAddTable.prototype.toSQL = function() {	
	var table = this.schema.table(this.tableDef.name);
	var createSQL = this.schema.sqlBuilder.createTableSQL(table);
	var insertPropSQL = table.insertPropSQL({deep: true});

	return createSQL + insertPropSQL;
}

/*
 * set table. 
 * drops and re-creates a table 
 * 
 * patch path must start with /tables/<name>/
 *
 */

var SCSetTable = function(patch, schema) {
	log.trace({patch: patch}, "SchemaChange.SCSetTable()");
	SchemaChange.call(this, patch, schema);
	this.op = SchemaChange.OPS.SET_TABLE;
	
	var pathArray = patch.path.split('/');
	pathArray.shift(); // leading slash,
	pathArray.shift(); // 'tables' keyword
	this.table = this.schema.table(pathArray.shift());
	this.patch_path = '/' + pathArray.join('/');
	this.path = '/' + this.table.name;
	
	this.obj = this.table.toJSON(); 
}

SCSetTable.prototype = new SchemaChange;	

SCSetTable.test = function(patch) {
	return /^\/tables\/(\w+)\//.test(patch.path);	
}

SCSetTable.prototype.apply = function() {
	this.table = new Table(this.obj);
}

SCSetTable.prototype.toSQL = function() {
	var deletePropSQL = this.table.deletePropSQL({deep: true});
	var dropSQL = this.table.dropSQL();

	var createSQL = this.schema.sqlBuilder.createTableSQL(this.table);
	var insertPropSQL = this.table.insertPropSQL({deep: true});

	return deletePropSQL + dropSQL + createSQL + insertPropSQL;
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
	this.table = this.schema.table(pathArray.shift());
	this.path = '/' + this.table.name;
}

SCDelTable.prototype = new SchemaChange;	

SCDelTable.test = function(patch) {
	return /^\/tables\/(\w+)$/.test(patch.path); 
}

SCDelTable.prototype.apply = function() {
	this.schema.removeTable(this.table.name);
}

SCDelTable.prototype.toSQL = function() {
	var deletePropSQL = this.table.deletePropSQL({deep: true});
	var dropSQL = this.table.dropSQL();
	return deletePropSQL + dropSQL;
}


/*
 * table access control. path e.g. /tables/1/access_control
 */

var SCTableAccess = function(patch, schema) {
	log.trace({patch: patch}, "SchemaChange.SCTableAccess()");
	SchemaChange.call(this, patch, schema);
	this.op = SchemaChange.OPS.SET_ACCESS_CONTROL;
	
	var pathArray = patch.path.split('/');
	pathArray.shift(); // leading slash,
	pathArray.shift(); // 'tables' keyword
	this.table = this.schema.table(pathArray.shift());
	pathArray.shift(); // 'access_control' keyword
	this.patch_path = '/' + pathArray.join('/');
	this.path = '/' + this.table.name + '/access_control';
	this.obj = JSON.parse(JSON.stringify(this.table.access_control)); //hold a copy
}

SCTableAccess.prototype = new SchemaChange;	

SCTableAccess.test = function(patch) {
	return /^\/tables\/(\w+)\/access_control/.test(patch.path);	
}

SCTableAccess.prototype.apply = function() {
	this.table.access_control = this.obj;
}

SCTableAccess.prototype.toSQL = function() {
	return this.table.updatePropSQL();
}

/*
 * table properties. path e.g. /tables/3/props/order
 */

var SCTableProps = function(patch, schema) {
	log.trace({patch: patch}, "SchemaChange.SCTableProps()");
	SchemaChange.call(this, patch, schema);
	this.op = SchemaChange.OPS.SET_PROP_TABLE;
	
	var pathArray = patch.path.split('/');
	pathArray.shift(); // leading slash,
	pathArray.shift(); // 'tables' keyword
	this.table = this.schema.table(pathArray.shift());
	pathArray.shift(); // 'props' keyword
	this.patch_path = '/' + pathArray.join('/');
	this.path = '/' + this.table.name + '/props';
	this.obj = JSON.parse(JSON.stringify(this.table.props)); //hold a copy
}

SCTableProps.prototype = new SchemaChange;	

SCTableProps.test = function(patch) {
	return /^\/tables\/(\w+)\/props\//.test(patch.path);	
}

SCTableProps.prototype.apply = function() {
	_.each(this.obj, function(v, k) {
		this.table.setProp(k, v); 
	}, this);
}

SCTableProps.prototype.toSQL = function() {
	return this.table.updatePropSQL();
}

/*
 * database users. path e.g. /users/3
*/

var SCUsers = function(patch, schema) {
	log.trace({patch: patch}, "SchemaChange.SCUsers()");
	SchemaChange.call(this, patch, schema);
	this.op = SchemaChange.OPS.SET_USER;

	var pathArray = patch.path.split('/');
	pathArray.shift(); // leading slash,
	pathArray.shift(); // 'users' keyword
	this.patch_path = '/' + pathArray.join('/');
	this.path = '/users';
	this.obj = JSON.parse(JSON.stringify(this.schema.users));
}

SCUsers.prototype = new SchemaChange;	

SCUsers.test = function(patch) {
	return /^\/users/.test(patch.path);	
}

SCUsers.prototype.apply = function() {
	this.schema.users = [];
	_.each(this.obj, function(user) {
		this.schema.setUser(user.name, user.role); 
	}, this);
}

SCUsers.prototype.toSQL = function() {
	return this.schema.updatePropSQL();
}

exports.SchemaChange = SchemaChange;

