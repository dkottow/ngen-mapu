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

		me.props.order = me.props.order || 100;
		me.props.width = me.props.width || me.defaultWidth();
	}
}

Field.TABLE = '__fieldprops__';
Field.TABLE_FIELDS = ['name', 'table_name', 'props', 'disabled'];

//adding or removing PROPERTIES needs no change in db schema
Field.PROPERTIES = ['order', 'width', 'scale', 'visible', 'label'];

//logical field type names - mapped to SQL types through SqlHelper.typeSQL
//	text has optional length arg, e.g. text(256) or text(MAX)
//	decimal has optional precision and scale args, e.g. decimal(6,2) 
Field.TYPES = ['text', 'integer', 'decimal', 'date', 'timestamp', 'float' ];

Field.create = function(fieldDef) {
	var fieldType = SqlHelper.typeName(fieldDef.type);

	if (fieldType == 'text') return new FieldText(fieldDef);
	if (fieldType == 'integer') return new FieldInteger(fieldDef);
	if (fieldType == 'decimal') return new FieldDecimal(fieldDef);
	if (fieldType == 'date') return new FieldDate(fieldDef);
	if (fieldType == 'timestamp') return new FieldTimestamp(fieldDef);
	if (fieldType == 'float') return new FieldFloat(fieldDef);

	throw new Error(util.format("Field.create(%s) failed. Unknown type.", util.inspect(fieldDef)));
}

Field.ROW_ALIAS = 'ref';

Field.parseDateUTC = function(str) {
	if (str.match(/z$/)) return new Date(str);
	else return new Date(str + 'Z');
}

Field.dateToString = function(date) {
	return date.toISOString().replace('T', ' ').substr(0, 19); //up to secs
}

Field.prototype.defaultWidth = function() {
	return 16; //override me according to type
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

Field.prototype.refName = function() {
	if (this.name.match(/id$/)) return this.name.replace(/id$/, "ref");
	else return this.name + "_ref";
}

Field.prototype.typeName = function() {
	return this.type; //override me if type has modifiers such as text(256) or decimal(6,2)
}


Field.prototype.parse = function() {
	throw new Error('Field base class does not define parse().');
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

Field.prototype.toSQL = function(table) {
	var sql = '"' + this.name + '" ' + SqlHelper.Field.typeSQL(this.type);
	if (this.name == 'id') sql += ' ' + SqlHelper.Field.autoIncrementSQL();
	if (this.notnull) sql += ' NOT NULL';
	sql += ' ' + SqlHelper.Field.defaultSQL(this);
	sql += ' ' +  SqlHelper.Field.foreignKeySQL(table, this);
	return sql;
}

//Field.TYPES = ['text', 'integer', 'decimal', 'date', 'timestamp', 'float' ];
var FieldText = function(attrs) {
	log.trace({attrs: attrs}, "new FieldText()");
	Field.call(this, attrs);
}
FieldText.prototype = new Field;	
FieldText.prototype.constructor = FieldText;
FieldText.prototype.typeName = function() { return 'text'; }
FieldText.prototype.defaultWidth = function() { return 20; }
FieldText.prototype.parse = function(val) { return val == null ? null : String(val); }


var FieldInteger = function(attrs) {
	log.trace({attrs: attrs}, "new FieldInteger()");
	Field.call(this, attrs);
}
FieldInteger.prototype = new Field;	
FieldInteger.prototype.constructor = FieldInteger;
FieldInteger.prototype.defaultWidth = function() { return 4; }
FieldInteger.prototype.parse = function(val) { return val == null ? null : parseInt(val); }


var FieldDecimal = function(attrs) {
	log.trace({attrs: attrs}, "new FieldDecimal()");
	Field.call(this, attrs);
}
FieldDecimal.prototype = new Field;	
FieldDecimal.prototype.constructor = FieldDecimal;
FieldDecimal.prototype.typeName = function() { return 'decimal'; }
FieldDecimal.prototype.defaultWidth = function() { return 8; }
FieldDecimal.prototype.parse = function(val) { return val == null ? null : parseFloat(val); }


var FieldDate = function(attrs) {
	log.trace({attrs: attrs}, "new FieldDate()");
	Field.call(this, attrs);
}
FieldDate.prototype = new Field;	
FieldDate.prototype.constructor = FieldDate;
FieldDate.prototype.defaultWidth = function() { return 8; }
FieldDate.prototype.parse = function(val) { 
	if (val == null) return null;
	var d = Field.parseDateUTC(val);
	return d.toISOString().substring(0, 10);
}


var FieldTimestamp = function(attrs) {
	log.trace({attrs: attrs}, "new FieldTimestamp()");
	Field.call(this, attrs);
}
FieldTimestamp.prototype = new Field;	
FieldTimestamp.prototype.constructor = FieldTimestamp;
FieldTimestamp.prototype.defaultWidth = function() { return 16; }
FieldTimestamp.prototype.parse = function(val) { return val == null ? null : new Date(val).toISOString(); }
FieldDate.prototype.parse = function(val) { 
	if (val == null) return null;
	var d = Field.parseDateUTC(val);
	return Field.dateToString(d);
}


var FieldFloat = function(attrs) {
	log.trace({attrs: attrs}, "new FieldFloat()");
	Field.call(this, attrs);
}
FieldFloat.prototype = new Field;	
FieldFloat.prototype.constructor = FieldFloat;
FieldFloat.prototype.defaultWidth = function() { return 8; }
FieldFloat.prototype.parse = function(val) { return val == null ? null : parseFloat(val); }

exports.Field = Field;

