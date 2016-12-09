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

global.log = global.log || require('bunyan').createLogger({name: 'nn'});
var log = global.log.child({'mod': 'g6.SchemaChange.js'});

//console.log('TMP DIR ' + tmp_dir);

var SchemaChange = function(path, schema) {
	//prototype defs call the ctor with no args, get out!
	//if (schema == undefined) return;
	this.schema = schema;
}

SchemaChange.OPS = {
	SET_PROP_TABLE: 'set_prop_table', 
	SET_PROP_FIELD: 'set_prop_field', 
	DISABLE_FIELD: 'disable_field', 
	SET_USER: 'set_user', 
	//TODO
	SET_ACCESS_CONTROL: 'set_access_control', 
	ADD_FIELD: 'add_field', 
	ADD_TABLE: 'add_table'
};

SchemaChange.create = function(path, schema) {

	this.schema = schema;
	if (SCFieldProps.test(path)) {
		return new SCFieldProps(path, schema);
		
	} else if (SCDisableField.test(path)) {
		return new SCDisableField(path, schema);

	} else if (SCTableProps.test(path)) {
		return new SCTableProps(path, schema);

	} else if (SCTableAccess.test(path)) {
		return new SCTableAccess(path, schema);

	} else if (SCUsers.test(path)) {
		return new SCUsers(path, schema);
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


/*
 * field properties. path e.g. /tables/3/fields/2/props/order
 */

var SCFieldProps = function(path, schema) {
	SchemaChange.call(this, path, schema);
	this.op = SchemaChange.OPS.SET_PROP_FIELD;
	
	var pathArray = path.split('/');
	pathArray.shift(); // leading slash,
	pathArray.shift(); // 'tables' keyword
	this.table = this.schema.tableArray()[ pathArray.shift() ];
	pathArray.shift(); // 'field' keyword
	this.field = this.table.fieldArray()[ pathArray.shift() ];
	pathArray.shift(); // 'props' keyword
	this.patch_path = '/' + pathArray.join('/');
	this.path = '/' + this.table.name + '/' + this.field.name + '/props';
	this.obj = JSON.parse(JSON.stringify(this.field.props)); //hold a copy
}


SCFieldProps.prototype = new SchemaChange;	

SCFieldProps.test = function(path) {
	return /^\/(\w+)\/(\d+)\/(\w+)\/(\d+)\/props\//.test(path);	
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

var SCDisableField = function(path, schema) {
	SchemaChange.call(this, path, schema);
	this.op = SchemaChange.OPS.DISABLE_FIELD;
	
	var pathArray = path.split('/');
	pathArray.shift(); // leading slash,
	pathArray.shift(); // 'tables' keyword
	this.table = this.schema.tableArray()[ pathArray.shift() ];
	pathArray.shift(); // 'field' keyword
	this.field = this.table.fieldArray()[ pathArray.shift() ];
	this.patch_path = '/' + pathArray.join('/');
	this.path = '/' + this.table.name + '/' + this.field.name + '/disabled';
	this.obj = JSON.parse(JSON.stringify(this.field)); 
}


SCDisableField.prototype = new SchemaChange;	

SCDisableField.test = function(path) {
	return /^\/(\w+)\/(\d+)\/(\w+)\/(\d+)\/disabled/.test(path);	
}

SCDisableField.prototype.apply = function() {
	this.field.setDisabled(this.obj.disabled);
}

SCDisableField.prototype.toSQL = function() {
	return this.field.updatePropSQL(this.table);
}

/*
 * table access control. path e.g. /tables/1/access_control
 */

var SCTableAccess = function(path, schema) {
	SchemaChange.call(this, path, schema);
	this.op = SchemaChange.OPS.SET_ACCESS_CONTROL;
	
	var pathArray = path.split('/');
	pathArray.shift(); // leading slash,
	pathArray.shift(); // 'tables' keyword
	this.table = this.schema.tableArray()[ pathArray.shift() ];
	pathArray.shift(); // 'access_control' keyword
	this.patch_path = '/' + pathArray.join('/');
	this.path = '/' + this.table.name + '/access_control';
	this.obj = JSON.parse(JSON.stringify(this.table.access_control)); //hold a copy
}

SCTableAccess.prototype = new SchemaChange;	

SCTableAccess.test = function(path) {
	return /^\/(\w+)\/(\d+)\/access_control/.test(path);	
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

var SCTableProps = function(path, schema) {
	SchemaChange.call(this, path, schema);
	this.op = SchemaChange.OPS.SET_PROP_TABLE;
	
	var pathArray = path.split('/');
	pathArray.shift(); // leading slash,
	pathArray.shift(); // 'tables' keyword
	this.table = this.schema.tableArray()[ pathArray.shift() ];
	pathArray.shift(); // 'props' keyword
	this.patch_path = '/' + pathArray.join('/');
	this.path = '/' + this.table.name + '/props';
	this.obj = JSON.parse(JSON.stringify(this.table.props)); //hold a copy
}

SCTableProps.prototype = new SchemaChange;	

SCTableProps.test = function(path) {
	return /^\/(\w+)\/(\d+)\/props\//.test(path);	
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

var SCUsers = function(path, schema) {
	SchemaChange.call(this, path, schema);
	this.op = SchemaChange.OPS.SET_USER;

	var pathArray = path.split('/');
	pathArray.shift(); // leading slash,
	pathArray.shift(); // 'users' keyword
	this.patch_path = '/' + pathArray.join('/');
	this.path = '/users';
	this.obj = JSON.parse(JSON.stringify(this.schema.users));
}

SCUsers.prototype = new SchemaChange;	

SCUsers.test = function(path) {
	return /^\/users/.test(path);	
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

