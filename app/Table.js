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

var Field = require('./Field.js').Field;

var log = require('./log.js').log;

var Table = function(tableDef) {

	var me = this;
	me._fields = {};

	init(tableDef);

	function init(tableDef) {
		var errMsg = util.format("Table.init(%s) failed. "
					, util.inspect(tableDef));

		if ( ! tableDef.name) {
			log.error({ tableDef: tableDef }, "Table.init() failed.");
			throw new Error("Table.init() failed. "
				+ 'Table name missing.');
		}

		if ( ! /^\w+$/.test(tableDef.name)) {
			log.error({ tableDef: tableDef }, "Table.init() failed.");
			throw new Error("Table.init() failed. "
					+ " Table names can only have word-type characters.");
		}

		tableDef.fields = tableDef.fields || [];

		var fieldNames = _.pluck(tableDef.fields, 'name');
		
		var missFields = _.filter(Table.MANDATORY_FIELDS, function(mf) {
			return ! _.contains(fieldNames, mf.name);
		});
		
		var fields = tableDef.fields;
		_.each(missFields, function(mf) {
			fields[mf.name] = mf;
		});
		
		_.each(fields, function(f) {
			me._fields[f.name] = Field.create(f);
		});

		me.name = tableDef.name;

		//row alias
		me.row_alias = tableDef.row_alias || [];

		if (tableDef.access_control) {
			me.access_control = tableDef.access_control;
		} else {
			me.access_control = _.map(Table.DEFAULT_ACCESS_CONTROL
								, function(ac) {
					return _.clone(ac);	
			});
		}

		//dont set disable prop if false
		if (tableDef.disabled) me.disabled = true;

		//property values
		me.props = tableDef.props;

	}
}

Table.MANDATORY_FIELDS = [
	{ name: 'id', type: 'INTEGER', props: { order: 1} }
	, { name : 'own_by', type: 'VARCHAR', props: {order: 90} }
	, { name : 'mod_by', type: 'VARCHAR', props: {order: 91} }
	, { name : 'mod_on', type: 'DATETIME', props: {order: 92} }
	, { name : 'add_by', type: 'VARCHAR', props: {order: 93} }
	, { name : 'add_on', type: 'DATETIME', props: {order: 94} }
];

Table.ROW_SCOPES = {
	NONE: "none",
	OWN: "own",
	ALL: "all" 
}

//must match Schema.js TODO
var USER_ROLES = {
	OWNER: "owner",
	WRITER: "writer",
	READER: "reader"
};

Table.DEFAULT_ACCESS_CONTROL = [

    { "role": USER_ROLES.READER
	, "write": Table.ROW_SCOPES.NONE
	, "read": Table.ROW_SCOPES.ALL }

    , { "role": USER_ROLES.WRITER
	, "write": Table.ROW_SCOPES.OWN
	, "read": Table.ROW_SCOPES.ALL }
];

Table.TABLE = '__tableprops__';
Table.TABLE_FIELDS = ['name', 'props', 'disabled'];
Table.ALL_FIELDS = '*';

//only these are stored and returned as JSON
Table.PROPERTIES = ['order', 'label'];

Table.prototype.setProp = function(name, value) {
	this.props[name] = value;
}

Table.prototype.access = function(user) {
	if (user.admin || user.role == USER_ROLES.OWNER) {
	    return { 
	    	read: Table.ROW_SCOPES.ALL 
	    	, write: Table.ROW_SCOPES.ALL
	    }
	} else {
		var match = _.find(this.access_control, function(ac) {
			return ac.role == user.role;
		});
		if ( ! match) {
		    return { 
		    	read: Table.ROW_SCOPES.NONE
		    	, write: Table.ROW_SCOPES.NONE
		    }
		}

		return _.pick(match, ["read", "write"]);
	}
	
}

Table.prototype.setAccess = function(role, access, scope) {
	var match = _.find(this.access_control, function(ac) {
		return ac.role == role;
	});
	if ( ! match) { 
		throw new Error(util.format('set access role %s not supported.', role));
	}
	if ( ! match[access]) { 
		throw new Error(util.format('access type %s unknown.', access));
	}
	if ( ! _.contains(Table.ROW_SCOPES, scope)) { 
		throw new Error(util.format('access scope %s unknown.', scope));
	}
	
	match[access] = scope; 
}


Table.CreateTableSQL = "CREATE TABLE " + Table.TABLE + " ("
		+ " name VARCHAR NOT NULL, "
		+ "	props VARCHAR, "
		+ " disabled INTEGER DEFAULT 0, "
		+ "	PRIMARY KEY (name) "
		+ ");\n\n";

Table.prototype.persistentProps = function() {
	var dbProps = {
		row_alias: this.row_alias
		, access_control: this.access_control
	};
	_.extend(dbProps, _.pick(this.props, Table.PROPERTIES));
	return dbProps;
}


Table.prototype.updatePropSQL = function(opts) {

	opts = opts || {};
	var deep = opts.deep || false;

	var props = this.persistentProps();

	var sql = "UPDATE " + Table.TABLE 
			+ " SET props = '" + JSON.stringify(props) + "'"
			+ " , disabled = " + (this.disabled ? 1 : 0)
			+ " WHERE name = '" + this.name + "'; ";

	if (deep) {
		_.each(this.fields(), function(f) {
			sql += "\n" + f.updatePropSQL(this);
		}, this);
	}

	log.trace({sql: sql}, "Table.updatePropSQL()");
	return sql;
}

Table.prototype.insertPropSQL = function(opts) {

	opts = opts || {};
	var deep = opts.deep || false;

	var props = this.persistentProps();

	var values = _.map([
			this.name, 
			JSON.stringify(props),
		], function(v) {
		return "'" + v + "'";
	}).concat([
		this.disabled ? 1 : 0
	]);

	var fields = _.map(Table.TABLE_FIELDS, function(f) {
		return '"' + f + '"';
	});

	var sql = 'INSERT INTO ' + Table.TABLE
			+ ' (' + fields.join(',') + ') ' 
			+ ' VALUES (' + values.join(',') + '); ';

	if (deep) {
		_.each(this.fields(), function(f) {
			sql += "\n" + f.insertPropSQL(this);
		}, this);
	}

	log.trace({sql: sql}, "Table.insertPropSQL()");
	return sql;
}

Table.prototype.deletePropSQL = function(opts) {
	opts = opts || {};
	var deep = opts.deep || false;

	var sql = 'DELETE FROM ' + Table.TABLE 
		+ " WHERE name = '" + this.name + "'" + ';\n';

	if (deep) {
		sql += 'DELETE FROM ' + Field.TABLE
		+ " WHERE table_name = '" + this.name + "'" + ';\n';
	}

	log.trace({sql: sql}, "Table.deletePropSQL()");
	return sql;
}



Table.prototype.fields = function() {
	return this._fields;
}

Table.prototype.field = function(name) {
	return this.fields()[name];
	//if ( ! field) throw new Error(util.format('field %s not found.', name));
}

Table.prototype.addField = function(field) {
	if ( ! field instanceof Field) 
		throw new Error('Type mismatch error on addField'); 

	this._fields[field.name] = new Field(field.toJSON());
}

Table.prototype.foreignKeys = function() {
	return _.select(this.fields(), function(f) { 
		return f.fk == 1; 
	});
}

Table.prototype.viewName = function() { return 'v_' + this.name; }
Table.prototype.ftsName = function() { return 'fts_' + this.name; }

Table.prototype.virtualFields = function() {

	return _.map(this.foreignKeys(), function(f) { 
		return f.refName();
	});
}

Table.prototype.viewFields = function() {

	var enabledFields = _.filter(this.fields(), function(f) {
		return f.disabled != true;
	});

	return [Field.REF_NAME]
			.concat( _.pluck(enabledFields, 'name'))
			.concat(this.virtualFields());
}

Table.prototype.assertQueryField = function(fieldName) {
	//must be a view field or the name of the table (for search filter)
	if ( ! _.contains(this.viewFields(), fieldName) && fieldName != Table.ALL_FIELDS) {
		throw new Error("unknown field '" + fieldName + "'");
	}			
}

Table.prototype.createSQL = function() {
	var sql = "CREATE TABLE " + this.name + "(";
	_.each(this.fields(), function(f) {
		sql += "\n" + f.toSQL() + ",";
	});
	sql += "\n PRIMARY KEY (id)";
	sql += "\n);";

	log.trace(sql);
	return sql;
}

Table.prototype.addFieldSQL = function(field) {
	var sql = "ALTER TABLE " + this.name 
		+ " ADD COLUMN " + field.toSQL() + ";\n";

	log.trace(sql);
	return sql;
}

function tableAlias(name, idx) {
	return name + '_' + idx;
}

Table.prototype.alias = function(idx) {
	return tableAlias(this.name, idx);
}

Table.prototype.allFieldClauses = function() {
	return _.map(this.viewFields(), function(vf) {
		return { table: this.name, field: vf };
	}, this);
}

/* 

use triggers to populate https://github.com/coolaj86/sqlite-fts-demo

sqlite> create trigger orders_ai after insert on orders begin    
...>    insert into fts_orders (docid,content) select id as docid, customers_ || ' yes' as content from v_orders where id = new.id; 
...>end;

*/

Table.prototype.dropTriggerSQL = function() {
	var sql = 'DROP TRIGGER IF EXISTS tgr_' + this.name + '_ai;\n'
		+ 'DROP TRIGGER IF EXISTS tgr_' + this.name + '_bu;\n'
		+ 'DROP TRIGGER IF EXISTS tgr_' + this.name + '_au;\n'
		+ 'DROP TRIGGER IF EXISTS tgr_' + this.name + '_bd;\n\n';

	return sql;
}

Table.prototype.createTriggerSQL = function() {
	var viewFields = this.viewFields();

	var content = _.map(viewFields, function(f) {
		return util.format("COALESCE(\"%s\", '')", f);
	}).join(" || ' ' || ");	

	var sql = 'CREATE TRIGGER tgr_' + this.name + '_ai'
		+ ' AFTER INSERT ON ' + this.name
		+ ' BEGIN\n INSERT INTO ' + this.ftsName() + ' (docid, content) '
		+ ' SELECT id AS docid, ' + content + ' as content'
		+ ' FROM ' + this.viewName() + ' WHERE id = new.id;'
		+ '\nEND;\n\n';

	sql += 'CREATE TRIGGER tgr_' + this.name + '_bu '
		+ ' BEFORE UPDATE ON ' + this.name
		+ ' BEGIN\n DELETE FROM ' + this.ftsName() 
		+ ' WHERE docid = old.id;'
		+ '\nEND;\n\n';

	sql += 'CREATE TRIGGER tgr_' + this.name + '_au'
		+ ' AFTER UPDATE ON ' + this.name
		+ ' BEGIN\n INSERT INTO ' + this.ftsName() + ' (docid, content) '
		+ ' SELECT id AS docid, ' + content + ' as content'
		+ ' FROM ' + this.viewName() + ' WHERE id = new.id;'
		+ '\nEND;\n\n';

	sql += 'CREATE TRIGGER tgr_' + this.name + '_bd '
		+ ' BEFORE DELETE ON ' + this.name
		+ ' BEGIN\n DELETE FROM ' + this.ftsName() 
		+ ' WHERE docid = old.id;'
		+ '\nEND;\n\n';

	return sql;
}

Table.prototype.createSearchSQL = function() {
	var viewFields = this.viewFields();

	var createSQL = 'CREATE VIRTUAL TABLE ' + this.ftsName() 
			+ ' USING fts4(content, tokenize=simple "tokenchars=-");\n\n';
	var triggerSQL = this.createTriggerSQL();
	var sql = createSQL + triggerSQL;

	log.trace({ sql: sql }, 'Table.createSearchSQL()');
	return sql;
}

Table.prototype.dropViewSQL = function() {
	return 'DROP VIEW IF EXISTS ' + this.viewName() + ';\n'
}

Table.prototype.dropSQL = function() {
	return this.dropViewSQL()
		+  'DROP TABLE IF EXISTS ' + this.ftsName() + ';\n'
		+  'DROP TABLE IF EXISTS ' + this.name + ';\n\n'
}

Table.prototype.toJSON = function() {

	var result = {
		name: this.name 
		, row_alias: this.row_alias
		, access_control: this.access_control
		, props: _.pick(this.props, Table.PROPERTIES)
		, disabled: this.disabled
	};

	result.fields = _.mapObject(this.fields(), function(field) {
		return field.toJSON();
	});

	//console.log(result);
	return result;
}

Table.TABLE_FIELD_SEPARATOR = '$';

exports.Table = Table;

