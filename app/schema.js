var  fs = require('fs')
  	, _ = require('underscore')
  	, util = require('util')
	, assert = require('assert');

//const
var TABLEDEF_NAME = "_tabledef_";
var FIELDDEF_NAME = "_fielddef_";

var schema = {};

	schema.Field = function(fieldDef) {
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
			assert(_.has(fieldDef, "order"), errMsg + " Order attr missing.");

			me.name = fieldDef.name;
			me.type = fieldDef.type;
			me.order = fieldDef.order;
			me.fk_table = fieldDef.fk_table;
			if (me.fk_table) me.fk_field = "id";
		}
	}

	schema.Field.prototype.constraintSQL = function() {
		return "";
	}

	schema.Field.prototype.toSQL = function() {
		var sql = '"' + this.name + '" ' + this.type;
		if (this.notnull) sql += " NOT NULL";
		sql += " " + this.constraintSQL();
		return sql;
	}
	
	schema.Field.prototype.defSQL = function(table) {
		var custom = "";
		var domain = "";
		if (this.domain) domain = JSON.stringify(this.domain);

		var sql = "INSERT INTO " + FIELDDEF_NAME
			    + " (name, table_name, ordering, domain, custom) VALUES("
				+ "'" + this.name + "', "
				+ "'" + table.name + "', "
				+ this.order + ", "
				+ "'" + domain + "', "
				+ "'" + custom + "');";
		return sql;
	}



	schema.TextField = function(fieldDef) {
		schema.Field.call(this, fieldDef);
	}

	schema.TextField.prototype = new schema.Field;	

	schema.TextField.prototype.constraintSQL = function() {
		var sql = "CONSTRAINT chk_" + this.name + " CHECK ("
				+ 'typeof("' + this.name + '") in ' 
				+ "('text', 'null'))";
		return sql;
	}

	schema.IntegerField = function(fieldDef) {
		schema.Field.call(this, fieldDef);
	}

	schema.IntegerField.prototype = new schema.Field;	

	schema.IntegerField.prototype.constraintSQL = function() {
		var sql = "CONSTRAINT chk_" + this.name + " CHECK ("
				+ 'typeof("' + this.name + '") in ' 
				+ "('integer', 'null'))";
		return sql;
	}


	schema.NumericField = function(fieldDef) {
		schema.Field.call(this, fieldDef);
	}

	schema.NumericField.prototype = new schema.Field;	

	schema.NumericField.prototype.constraintSQL = function() {
		var sql = "CONSTRAINT chk_" + this.name + " CHECK ("
				+ 'typeof("' + this.name + '") in ' 
				+ "('real', 'integer', 'null'))";
		return sql;
	}

	schema.DatetimeField = function(fieldDef) {
		schema.Field.call(this, fieldDef);
	}

	schema.DatetimeField.prototype = new schema.Field;	

	schema.DatetimeField.prototype.constraintSQL = function() {
		var sql = "CONSTRAINT chk_" + this.name + " CHECK ("
				+ 'julianday("' + this.name + '") is not null'
				+ ' or "' + this.name + '" is null)';
		return sql;
	}

	function createField(fieldDef) {
		var errMsg = util.format("createField(%s) failed. "
					, util.inspect(fieldDef));
		assert(_.has(fieldDef, "type"), errMsg + " Type attr missing.");

		if (fieldDef.type.indexOf("VARCHAR") == 0) {
			return new schema.TextField(fieldDef);
		} else if (fieldDef.type == "INTEGER") {
			return new schema.IntegerField(fieldDef);
		} else if (fieldDef.type.indexOf("NUMERIC") == 0) {
			return new schema.NumericField(fieldDef);
		} else if (fieldDef.type == "DATETIME" || fieldDef.type == "DATE") {
			return new schema.DatetimeField(fieldDef);
		}

		throw new Error(util.format("createField(%s) failed. Unknown type.", util.inspect(fieldDef)));

	}

	schema.Table = function(tableDef) {

		var me = this;
		me.fields = {};

		init(tableDef);

		function init(tableDef) {
			var errMsg = util.format("Table.init(%s) failed. "
						, util.inspect(tableDef));

			assert(_.isObject(tableDef), errMsg);
			assert(_.has(tableDef, "name"), errMsg);
			assert(_.has(tableDef, "fields"), errMsg);
			assert(_.isObject(tableDef.fields), errMsg);

			_.each(tableDef.fields, function(f) {
				me.fields[f.name] = createField(f);
			});

			me.name = tableDef.name;
			me.row_name = tableDef.row_name;

			if( ! _.has(tableDef.fields, "id")) {
				throw new Error(errMsg + " Id field missing.");
			}
//TODO?
			if( ! _.has(tableDef.fields, "modified_by")) {
				throw new Error(errMsg + " Modified_by field missing.");
			}
			if( ! _.has(tableDef.fields, "modified_on")) {
				throw new Error(errMsg + " Modified_on field missing.");
			}
		}
	}

	function insertTableDefSQL(table) {

		var row_name = "";
		if (table.row_name) {
			row_name += JSON.stringify(table.row_name);
		}		

		var custom = "";
		if (table.custom) {
			custom += JSON.stringify(table.custom);
		}		

		var sql = "INSERT INTO " + TABLEDEF_NAME
			    + " (name, row_name, custom) VALUES("
				+ "'" + table.name + "', "
				+ "'" + row_name + "', "
				+ "'" + custom + "');";

		return sql;
	}

	schema.Table.prototype.insertDefSQL = function() {

		var sql = insertTableDefSQL(this);
		var me = this;
		_.each(this.fields, function(f) {
			sql += "\n" + f.defSQL(me);
		});
		return sql;
	}

	schema.Table.prototype.toSQL = function() {
		var sql = "CREATE TABLE " + this.name + "(";
		_.each(this.fields, function(f) {
			sql += "\n" + f.toSQL() + ",";
		});
		sql += "\n PRIMARY KEY (id)";

		var fks = _.select(this.fields, function(f) { 
			return ! _.isEmpty(f.fk_table); 
		});

		_.each(fks, function(fk) {
			sql += ",\n FOREIGN KEY(" + fk.name + ") REFERENCES " 
				+ fk.fk_table + " (id)";
		});

		sql += "\n);";
console.log(sql);
		return sql;
	}

	schema.Database = function(tableDefs) {

		this.tableDefs = tableDefs;
		this.tables = {};
	}

	schema.Database.prototype.init = function(cbAfter) {
		try {
			var me = this;
			console.log(util.inspect(me.tableDefs));
			_.each(me.tableDefs, function(tableDef) {
				var table = new schema.Table(tableDef);
				me.tables[table.name] = table;			

			});
			//console.log(util.inspect(me.tables, {depth: 99}));
			cbAfter();

		} catch(err) {
			//throw err;
			cbAfter(err);
		}
	}

	function createDefTables() {
		var sql = "";
		sql += "CREATE TABLE " + TABLEDEF_NAME + " ("
			+ " name VARCHAR NOT NULL, "
			+ " row_name VARCHAR, "
			+ "	custom VARCHAR, "
			+ "	PRIMARY KEY (name) "
			+ ");\n\n";

		sql += " CREATE TABLE " + FIELDDEF_NAME + " ("
			+ " name VARCHAR NOT NULL, "
			+ " table_name VARCHAR NOT NULL, "
			+ " ordering INTEGER NOT NULL, "
			+ " domain VARCHAR, "
			+ " custom VARCHAR, "
			+ " PRIMARY KEY (name, table_name) "
			+ ");\n\n";

		return sql;
	}

	schema.Database.prototype.createSQL = function() {
		var sql = createDefTables();

		_.each(this.tables, function(t) {
			sql += t.toSQL() + "\n\n";
		});

		_.each(this.tables, function(t) {
			sql += t.insertDefSQL() + "\n\n";
		});

		return sql;
	}

exports.Database = schema.Database;

