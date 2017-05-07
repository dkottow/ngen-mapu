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

var SqlHelper = require('./SqlHelperFactory.js').SqlHelperFactory.create();

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
		me.props = fieldDef.props || {};

		me.props.order = me.props.order || 0;
		me.props.width = me.props.width || me.defaultWidth();
	}
}

Field.TABLE = '__fieldprops__';
Field.TABLE_FIELDS = ['name', 'table_name', 'props', 'disabled'];

//adding or removing PROPERTIES needs no change in db schema
Field.PROPERTIES = ['order', 'width', 'scale', 'visible', 'label'];


Field.create = function(fieldDef) {
	var errMsg = util.format("Field.create(%s) failed. "
				, util.inspect(fieldDef));

	assert(_.has(fieldDef, "type"), errMsg + " Type attr missing.");

	if (_.contains(_.values(Field.TYPES), fieldDef.type)) {
		return new Field(fieldDef);
	}
	
	throw new Error(util.format("Field.create(%s) failed. Unknown type.", util.inspect(fieldDef)));

}

Field.typeName = function(sqlType) {
	if (sqlType.indexOf(Field.TYPES.text) == 0) {
		return 'text';
	} else if (sqlType == Field.TYPES.integer) {
		return 'integer';
	} else if (sqlType.indexOf(Field.TYPES.numeric) == 0) {
		return 'numeric';
	} else if (sqlType == Field.TYPES.datetime) {
		return 'datetime';
	} else if (sqlType == Field.TYPES.date) {
		return 'date';
	}
	return null;	
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


Field.prototype.persistentProps = function() {
	return _.pick(this.props, Field.PROPERTIES);
}

Field.prototype.updatePropSQL = function(table) {
	var props = this.persistentProps();

	var sql = 'UPDATE ' + Field.TABLE
			+ " SET props = '" + JSON.stringify(props) + "'"
			+ " , disabled = " + (this.disabled ? 1 : 0)
			+ util.format(" WHERE name = '%s' AND table_name = '%s'; ",
				this.name, table.name);

	return sql;
}

Field.prototype.typeName = function() {
	return Field.typeName(this.type);
}

Field.prototype.defaultWidth = function() {
	var typeName = this.typeName();

	if (typeName == 'integer') return 4;
	if (typeName == 'numeric') return 8;
	if (typeName == 'text') return 20;
	if (typeName == 'date') return 8;
	if (typeName == 'datetime') return 16;

	return 16;
}

Field.prototype.toJSON = function() {

	var result = {
		name: this.name
		, type: this.type
		, fk: this.fk
		, notnull: this.notnull
		, props: _.pick(this.props, Field.PROPERTIES)
	};

	if (this.disabled) {
		result.disabled = this.disabled;
	}

	if (result.fk == 1) {
		result.fk_table = this.fk_table;
	}

	return result;
}

Field.ROW_ALIAS = 'ref';

Field.prototype.refName = function() {
	if (this.name.match(/id$/)) return this.name.replace(/id$/, "ref");
	else return this.name + "_ref";
}

Field.TYPES = {
	'text': 'VARCHAR'
	, 'integer': 'INTEGER'
	, 'numeric': 'NUMERIC'
	, 'date': 'DATE'
	, 'datetime': 'DATETIME'
}

Field.dateToString = function(date) {
	return date.toISOString().replace('T', ' ').substr(0, 19); //up to secs
}


Field.prototype.insertPropSQL = function(table) {

	var props = this.persistentProps();

	var values = _.map([
			this.name, 
			table.name, 
			JSON.stringify(props)
		], function(v) {
		return "'" + v + "'";
	}).concat([
		this.disabled ? 1 : 0]
	);

	var fields = _.map(Field.TABLE_FIELDS, function(f) {
		return SqlHelper.EncloseSQL(f);
	});

	var sql = 'INSERT INTO ' + Field.TABLE
			+ ' (' + fields.join(',') + ') ' 
			+ ' VALUES (' + values.join(',') + '); ';

	return sql;
}

Field.prototype.foreignKeySQL = function() {
	return this.fk 
		? util.format("REFERENCES %s(%s)", this.fk_table, this.fk_field)
		: "";
}

Field.prototype.toSQL = function() {
	var sql = '"' + this.name + '" ' + SqlHelper.Field.typeSQL(this.type);
	if (this.notnull) sql += ' NOT NULL';
	sql += " " + SqlHelper.Field.defaultSQL(this);
	sql += " " +  this.foreignKeySQL(); //SqlHelper.Field.foreignKeySQL(this);
	return sql;
}


exports.Field = Field;

