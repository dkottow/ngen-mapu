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
var SchemaDefs = require('./SchemaDefs.js').SchemaDefs;

var Field = function(fieldDef) {
	//prototype defs call the ctor with no args, get out!
	if (fieldDef == undefined) return;

	var me = this;
	init(fieldDef);

	function init(fieldDef) {
		var errMsg = util.format("Field.init(%s) failed. "
					, util.inspect(fieldDef));

		if ( ! fieldDef.name) {
			log.error({ fieldDef: fieldDef }, "Field.init() failed.");
			throw new Error("Field.init() failed. Field name missing.");
		}

		if ( ! fieldDef.type) {
			log.error({ fieldDef: fieldDef }, "Field.init() failed.");
			throw new Error("Field.init() failed. Field type missing.");
		}
								
		if ( ! /^\w+$/.test(fieldDef.name)) {
			log.error({ fieldDef: fieldDef }, "Field.init() failed.");
			throw new Error("Field names can only have word-type characters: '" + fieldDef.name + "'");
		}

		me.name = fieldDef.name;
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

		_.each(Field.SYSTEM_PROPERTIES, function(p) {
			if (fieldDef.hasOwnProperty(p)) {
				me[p] = fieldDef[p];	
			} else {
				me[p] = Field.SYSTEM_PROPERTY_DEFAULTS[p];
			}
		});

	}
}

Field.SYSTEM_PROPERTIES = ['disabled'];
Field.SYSTEM_PROPERTY_DEFAULTS = {
	disabled: false
};


//Field.PROPERTIES = ['order', 'width', 'scale', 'visible', 'label'];

//logical field type names - mapped to SQL types through SqlHelper.typeSQL
//	text has optional length arg, e.g. text(256) or text(MAX)
//	decimal has optional precision and scale args, e.g. decimal(6,2) 
Field.TYPES = ['text', 'integer', 'decimal', 'date', 'timestamp', 'float', 'boolean' ];

Field.create = function(fieldDef) {
	var fieldType = SqlHelper.typeName(fieldDef.type);

	if (fieldType == 'text') return new FieldText(fieldDef);
	if (fieldType == 'integer') return new FieldInteger(fieldDef);
	if (fieldType == 'decimal') return new FieldDecimal(fieldDef);
	if (fieldType == 'date') return new FieldDate(fieldDef);
	if (fieldType == 'timestamp') return new FieldTimestamp(fieldDef);
	if (fieldType == 'float') return new FieldFloat(fieldDef);
	if (fieldType == 'boolean') return new FieldBoolean(fieldDef);
	
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

Field.prototype.toJSON = function() {

	var result = {
		name: this.name
		, type: this.type
		, fk: this.fk
		, notnull: this.notnull
	};

	if (result.fk == 1) {
		result.fk_table = this.fk_table;
	}
	
	_.each(Field.SYSTEM_PROPERTIES, function(p) {
		result[p] = this[p];
	}, this);

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

Field.prototype.toSQL = function(table) {
	var sql = '"' + this.name + '" ' + SqlHelper.Field.typeSQL(this.type);
	if (this.name == 'id') sql += ' ' + SqlHelper.Field.autoIncrementSQL();
	if (this.notnull) sql += ' NOT NULL';
	sql += ' ' + SqlHelper.Field.defaultSQL(this);
	sql += ' ' +  SqlHelper.Field.foreignKeySQL(table, this);
	return sql;
}

Field.prototype.systemPropertyRows = function(table) {
	var rows = [];
	_.each(Field.SYSTEM_PROPERTIES, function(name) {

		var propVal = JSON.stringify(this[name]);
		var defVal = JSON.stringify(Field.SYSTEM_PROPERTY_DEFAULTS[name]);
		if (propVal != defVal) {
			var row = {};	
			row[SchemaDefs.PROPERTIES_FIELDS.table] = table.name;
			row[SchemaDefs.PROPERTIES_FIELDS.field] = this.name;
			row[SchemaDefs.PROPERTIES_FIELDS.name] = name;
			row[SchemaDefs.PROPERTIES_FIELDS.value] = propVal;
			rows.push(row);
		}

	}, this);

	return rows;
}


//Field.TYPES = ['text', 'integer', 'decimal', 'date', 'timestamp', 'float' ];
var FieldText = function(attrs) {
	log.trace({attrs: attrs}, "new FieldText()");
	Field.call(this, attrs);
}
FieldText.prototype = new Field;	
FieldText.prototype.constructor = FieldText;
FieldText.prototype.typeName = function() { return 'text'; }
FieldText.prototype.parse = function(val) { return val == null ? null : String(val); }


var FieldInteger = function(attrs) {
	log.trace({attrs: attrs}, "new FieldInteger()");
	Field.call(this, attrs);
}
FieldInteger.prototype = new Field;	
FieldInteger.prototype.constructor = FieldInteger;
FieldInteger.prototype.parse = function(val) { return val == null ? null : parseInt(val); }


var FieldDecimal = function(attrs) {
	log.trace({attrs: attrs}, "new FieldDecimal()");
	Field.call(this, attrs);
}
FieldDecimal.prototype = new Field;	
FieldDecimal.prototype.constructor = FieldDecimal;
FieldDecimal.prototype.typeName = function() { return 'decimal'; }
FieldDecimal.prototype.parse = function(val) { return val == null ? null : parseFloat(val); }


var FieldDate = function(attrs) {
	log.trace({attrs: attrs}, "new FieldDate()");
	Field.call(this, attrs);
}
FieldDate.prototype = new Field;	
FieldDate.prototype.constructor = FieldDate;
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
FieldFloat.prototype.parse = function(val) { return val == null ? null : parseFloat(val); }

var FieldBoolean = function(attrs) {
	log.trace({attrs: attrs}, "new FieldBoolean()");
	Field.call(this, attrs);
}
FieldBoolean.prototype = new Field;	
FieldBoolean.prototype.constructor = FieldBoolean;
FieldBoolean.prototype.parse = function(val) { return val == null ? null : Boolean(val); }

exports.Field = Field;

