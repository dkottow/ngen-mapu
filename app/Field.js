var _ = require('underscore');
var util = require('util');
var assert = require('assert');

global.log = global.log || require('bunyan').createLogger({name: 'nn'});
var log = global.log.child({'mod': 'g6.Field.js'});

//console.log('TMP DIR ' + tmp_dir);

Field = function(fieldDef) {
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
Field.TABLE_FIELDS = ['name', 'table_name', 'props'];

//adding or removing PROPERTIES needs no change in db schema
Field.PROPERTIES = ['order', 'width', 'scale', 'label'];

Field.CreateTableSQL 
	= " CREATE TABLE " + Field.TABLE + " ("
		+ ' name VARCHAR NOT NULL, '
		+ ' table_name VARCHAR NOT NULL, '
		+ ' props VARCHAR, '
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
		return new DatetimeField(fieldDef);
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

Field.prototype.defaultSQL = function() {

	if (this.name == 'mod_on') {
		return "DEFAULT(datetime('now'))";

	} else if (this.name == 'mod_by') {
		return "DEFAULT 'sql'";

	} else {
		return "";
	}
}

Field.prototype.constraintSQL = function() {
	return "";
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
	sql += " " + this.constraintSQL();
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
	});

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
			+ util.format(" WHERE name = '%s' AND table_name = '%s'; ",
				this.name, table.name);

	return sql;
}

Field.prototype.defaultWidth = function() {
	if (this instanceof IntegerField) return 4;
	if (this instanceof NumericField) return 8;
	if (this instanceof TextField) return 20;
	if (this instanceof DatetimeField) return 16;
	return 16;
}

Field.prototype.toJSON = function() {

	var result = {
		name: this.name,
		type: this.type,
		fk: this.fk,
		notnull: this.notnull,
		props: this.props
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

TextField = function(fieldDef) {
	Field.call(this, fieldDef);
}

TextField.prototype = new Field;	

TextField.prototype.constraintSQL = function() {
	var sql = "CONSTRAINT chk_" + this.name + " CHECK ("
			+ 'typeof("' + this.name + '") in ' 
			+ "('text', 'null'))";
	return sql;
}

IntegerField = function(fieldDef) {
	Field.call(this, fieldDef);
}

IntegerField.prototype = new Field;	

IntegerField.prototype.constraintSQL = function() {
	var sql = "CONSTRAINT chk_" + this.name + " CHECK ("
			+ 'typeof("' + this.name + '") in ' 
			+ "('integer', 'null'))";
	return sql;
}


NumericField = function(fieldDef) {
	Field.call(this, fieldDef);
}

NumericField.prototype = new Field;	

NumericField.prototype.constraintSQL = function() {
	var sql = "CONSTRAINT chk_" + this.name + " CHECK ("
			+ 'typeof("' + this.name + '") in ' 
			+ "('real', 'integer', 'null'))";
	return sql;
}

DatetimeField = function(fieldDef) {
	Field.call(this, fieldDef);
}

DatetimeField.prototype = new Field;	

DatetimeField.prototype.constraintSQL = function() {
	var sql = "CONSTRAINT chk_" + this.name + " CHECK ("
			+ 'julianday("' + this.name + '") is not null'
			+ ' or "' + this.name + '" is null)';
	return sql;
}


exports.Field = Field;

