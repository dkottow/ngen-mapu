var _ = require('underscore');
var util = require('util');
var assert = require('assert');

global.log = global.log || require('bunyan').createLogger({
	name: 'g6.server',
	level: 'debug',
	src: true,
	stream: process.stderr
});


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
		me.notnull = fieldDef.notnull || 0;

		me.fk = fieldDef.fk_table ? 1 : 0;
		if (me.fk) {
			me.fk_table = fieldDef.fk_table;
			me.fk_field = "id";
		}

		//non-SQL attributes				
		_.each(Field.PROPERTIES, function(f) {
			me[f] = fieldDef[f];
		});

		//notnull
		me.order = me.order || 0;

		//parse possible JSON
		if (_.isString(me.domain)) {
			me.domain = JSON.parse(me.domain);
		}
	}
}

Field.TABLE = '__fieldprops__';
Field.PROPERTIES = ['order', 'domain', 'label']; //no change in db schema
Field.TABLE_FIELDS = ['name', 'table_name']
		.concat(Field.PROPERTIES);

Field.CreateTableSQL 
	= " CREATE TABLE " + Field.TABLE + " ("
		+ ' name VARCHAR NOT NULL, '
		+ ' table_name VARCHAR NOT NULL, '
		+ ' label VARCHAR, '
		+ '"order" INTEGER NOT NULL, '
		+ ' domain VARCHAR, '
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



Field.prototype.sqlValue = function(name) {
	switch(name) {
		case 'order': 
			return this.order;
		break;

		case 'domain': 
			return this.domain
				? "'" + JSON.stringify(this.domain) + "'"
				: 'null';
		break;			

		default:
			return this[name]
				? "'" + this[name] + "'"
				: 'null';
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
	sql += " " + this.constraintSQL();
	sql += " " + this.foreignKeySQL();
	return sql;
}

Field.prototype.insertPropSQL = function(table) {

	var values = [ this.sqlValue('name'), table.sqlValue('name') ];

	var props = _.map(Field.PROPERTIES, function(f) {
		return this.sqlValue(f);
	}, this);

	var fields = _.map(Field.TABLE_FIELDS, function(f) {
		return '"' + f + '"';
	});

	var sql = 'INSERT INTO ' + Field.TABLE
			+ ' (' + fields.join(',') + ') ' 
			+ ' VALUES (' + values.join(',') + ',' + props.join(',') + '); ';

	return sql;
}

Field.prototype.toJSON = function() {

	var result = {
		name: this.name,
		type: this.type,
		fk: this.fk,
		notnull: this.notnull
	};

	if (result.fk == 1) {
		result.fk_table = this.fk_table;
	}

	_.each(Field.PROPERTIES, function(f) {
		result[f] = this[f];
	}, this);

	return result;
}

Field.REF_NAME = 'ref';

Field.prototype.refName = function() {
	if (this.name.endsWith("id")) return this.name.replace(/id$/, "ref");
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

