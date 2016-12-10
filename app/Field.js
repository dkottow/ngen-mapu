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

var Field = function(fieldDef) {
	//prototype defs call the ctor with no args, get out!
	if (fieldDef == undefined) return;

	var me = this;
	init(fieldDef);

	function init(fieldDef) {
		var errMsg = util.format("Field.init(%s) failed. "
					, util.inspect(fieldDef));
		assert(_.isObject(fieldDef), errMsg);
		assert(_.has(fieldDef, "name"), errMsg + " Name attr missing.");
		assert(_.has(fieldDef, "type"), errMsg + " Type attr missing.");

		me.name = fieldDef.name;

		if ( ! /^\w+$/.test(fieldDef.name)) {
			throw new Error(errMsg 
					+ " Field names can only have word-type characters.");
		}

		me.type = fieldDef.type;

		//fk
		me.fk = fieldDef.fk_table ? 1 : 0;
		if (me.fk) {
			me.fk_table = fieldDef.fk_table;
			me.fk_field = "id";
		}

		//notnull
		if (me.name == "id" || me.fk == 1) {
			me.notnull = 1;
		} else {
			me.notnull = fieldDef.notnull || 0;
		}

		//dont show falsy disable prop
		if (fieldDef.disabled) me.disabled = true;

		//property values
		me.props = {};

		//default values
		me.props.order = 0;
		me.props.width = me.defaultWidth();

		//copy known props. 
		_.extend(me.props, _.pick(fieldDef.props, Field.PROPERTIES));
	}
}

Field.TABLE = '__fieldprops__';
Field.TABLE_FIELDS = ['name', 'table_name', 'props', 'disabled'];

//adding or removing PROPERTIES needs no change in db schema
Field.PROPERTIES = ['order', 'width', 'scale', 'visible', 'label'];

Field.CreateTableSQL 
	= " CREATE TABLE " + Field.TABLE + " ("
		+ ' table_name VARCHAR NOT NULL, '
		+ ' name VARCHAR NOT NULL, '
		+ ' props VARCHAR, '
		+ ' disabled INTEGER DEFAULT 0, '
		+ ' PRIMARY KEY (name, table_name) '
		+ ");\n\n";


Field.create = function(fieldDef) {
	var errMsg = util.format("Field.create(%s) failed. "
				, util.inspect(fieldDef));

	assert(_.has(fieldDef, "type"), errMsg + " Type attr missing.");

	if (fieldDef.type.indexOf("VARCHAR") == 0) {
		return new TextField(fieldDef);
	} else if (fieldDef.type == "INTEGER") {
		return new IntegerField(fieldDef);
	} else if (fieldDef.type.indexOf("NUMERIC") == 0) {
		return new NumericField(fieldDef);
	} else if (fieldDef.type == "DATETIME" || fieldDef.type == "DATE") {
		return new DateTimeField(fieldDef);
	}

	throw new Error(util.format("Field.create(%s) failed. Unknown type.", util.inspect(fieldDef)));

}

Field.prototype.setProp = function(name, value) {
	if (_.contains(Field.PROPERTIES, name)) {
		this.props[name] = value;
	} else {
		throw new Error(util.format('prop %s not found.', name));
	}
}

Field.prototype.setDisabled = function(disabled) {
	this.disabled = disabled == true;
}

Field.prototype.defaultSQL = function() {

	if (_.contains(['mod_on', 'add_on'], this.name)) {
		return "DEFAULT(datetime('now'))";

	} else if (_.contains(['mod_by', 'add_by'], this.name)) {
		return "DEFAULT 'sql'";

	} else {
		return "";
	}
}

Field.prototype.foreignKeySQL = function() {
	return this.fk 
		? util.format("REFERENCES %s(%s)", this.fk_table, this.fk_field)
		: "";
}

Field.prototype.toSQL = function() {
	var sql = '"' + this.name + '" ' + this.type;
	if (this.notnull) sql += " NOT NULL";
	sql += " " + this.defaultSQL();
	sql += " " + this.foreignKeySQL();
	return sql;
}

Field.prototype.insertPropSQL = function(table) {

	var values = _.map([
			this.name, 
			table.name, 
			JSON.stringify(this.props)
		], function(v) {
		return "'" + v + "'";
	}).concat([
		this.disabled ? 1 : 0]
	);

	var fields = _.map(Field.TABLE_FIELDS, function(f) {
		return '"' + f + '"';
	});

	var sql = 'INSERT INTO ' + Field.TABLE
			+ ' (' + fields.join(',') + ') ' 
			+ ' VALUES (' + values.join(',') + '); ';

	return sql;
}

Field.prototype.updatePropSQL = function(table) {
	var sql = 'UPDATE ' + Field.TABLE
			+ " SET props = '" + JSON.stringify(this.props) + "'"
			+ " , disabled = " + (this.disabled ? 1 : 0)
			+ util.format(" WHERE name = '%s' AND table_name = '%s'; ",
				this.name, table.name);

	return sql;
}

Field.prototype.defaultWidth = function() {
	if (this instanceof IntegerField) return 4;
	if (this instanceof NumericField) return 8;
	if (this instanceof TextField) return 20;
	if (this instanceof DateTimeField) return 16;
	return 16;
}

Field.prototype.toJSON = function() {

	var result = {
		name: this.name,
		type: this.type,
		fk: this.fk,
		notnull: this.notnull,
		props: this.props,
		disabled: this.disabled
	};

	if (result.fk == 1) {
		result.fk_table = this.fk_table;
	}

	return result;
}

Field.REF_NAME = 'ref';

Field.prototype.refName = function() {
	if (this.name.match(/id$/)) return this.name.replace(/id$/, "ref");
	else return this.name + "_ref";
}

var TextField = function(fieldDef) {
	Field.call(this, fieldDef);
}

TextField.prototype = new Field;	

var IntegerField = function(fieldDef) {
	Field.call(this, fieldDef);
}

IntegerField.prototype = new Field;	

var NumericField = function(fieldDef) {
	Field.call(this, fieldDef);
}

NumericField.prototype = new Field;	

var DateTimeField = function(fieldDef) {
	Field.call(this, fieldDef);
}

DateTimeField.prototype = new Field;	

DateTimeField.toString = function(date) {
	return date.toISOString().replace('T', ' ').substr(0, 19); //up to secs
}

exports.Field = Field;
exports.DateTimeField = DateTimeField;

