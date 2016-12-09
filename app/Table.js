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

var log = global.log.child({'mod': 'g6.Table.js'});

var Table = function(tableDef) {

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

		if ( ! /^\w+$/.test(tableDef.name)) {
			log.error({ tableDef: tableDef }, "Table.init() failed.");
			throw new Error("Table.init() failed. "
					+ " Table names can only have word-type characters.");
		}

		var fieldNames = _.pluck(tableDef.fields, 'name');
		_.each(Table.MANDATORY_FIELDS, function(mf) {
			if( ! _.contains(fieldNames, mf)) {
				log.error({ tableDef: tableDef }, "Table.init() failed.");
				throw new Error("Table.init() failed. Field " + mf + " missing.");
			}
		});

		_.each(tableDef.fields, function(f) {
			me.fields[f.name] = Field.create(f);
		});

		me.name = tableDef.name;

		//row alias
		me.row_alias = tableDef.row_alias || [];

		if (tableDef.access_control) {
			me.access_control = tableDef.access_control;
		} else {
			me.access_control = _.map(Table.DEFAULT_ACCESS_CONTROL, function(ac) {
				return _.clone(ac);	
			});
		}

		//dont show disable prop if false
		if (tableDef.disabled) me.disabled = true;

		//property values
		me.props = {};

		//copy known props. 
		_.extend(me.props, _.pick(tableDef.props, Table.PROPERTIES));

	}
}

Table.MANDATORY_FIELDS = ['id', 'add_by', 'add_on', 'mod_by', 'mod_on', 'own_by'];

Table.ROW_SCOPES = {
	NONE: "none",
	OWN: "own",
	ALL: "all" 
}

//TODO must match Schema.js
var USER_ROLES = {
	OWNER: "owner",
	WRITER: "writer",
	READER: "reader"
};

Table.DEFAULT_ACCESS_CONTROL = [
    { "role": USER_ROLES.READER, "write": Table.ROW_SCOPES.NONE, "read": Table.ROW_SCOPES.ALL }
    , { "role": USER_ROLES.WRITER, "write": Table.ROW_SCOPES.OWN, "read": Table.ROW_SCOPES.ALL }
];

Table.TABLE = '__tableprops__';
Table.TABLE_FIELDS = ['name', 'props', 'disabled'];
Table.ALL_FIELDS = '*';

Table.PROPERTIES = ['order', 'label'];

Table.prototype.setProp = function(name, value) {
	if (_.contains(Table.PROPERTIES, name)) {
		this.props[name] = value;
	} else {
		throw new Error(util.format('prop %s not found.', name));
	}
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
	_.extend(dbProps, this.props);
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
		_.each(this.fields, function(f) {
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
		_.each(this.fields, function(f) {
			sql += "\n" + f.insertPropSQL(this);
		}, this);
	}

	log.trace({sql: sql}, "Table.insertPropSQL()");
	return sql;
}

Table.prototype.fieldArray = function(name) {
	return _.sortBy(this.fields, function(field) { return field.name; });
}

Table.prototype.field = function(name) {
	var field = this.fields[name];
	if ( ! field) throw new Error(util.format('field %s not found.', name));
	return field;
}

Table.prototype.foreignKeys = function() {
	return _.select(this.fields, function(f) { 
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

	var enabledFields = _.filter(this.fields, function(f) {
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
	_.each(this.fields, function(f) {
		sql += "\n" + f.toSQL() + ",";
	});
	sql += "\n PRIMARY KEY (id)";

	sql += "\n);";
	log.debug(sql);

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

Table.prototype.createSearchSQL = function() {
	var viewFields = this.viewFields();

	var sql = 'CREATE VIRTUAL TABLE  ' + this.ftsName() 
			+ ' USING fts4(' +  viewFields.join(',') + ',' + 'tokenize=simple "tokenchars=-");\n\n';

	sql += 'CREATE TRIGGER tgr_' + this.name + '_ai'
		+ ' AFTER INSERT ON ' + this.name
		+ ' BEGIN\n INSERT INTO ' + this.ftsName() 
		+ ' (docid, ' + viewFields.join(',') + ') '
		+ ' SELECT id AS docid, ' + viewFields.join(',')
		+ ' FROM ' + this.viewName() + ' WHERE id = new.id;'
		+ '\nEND;\n\n';

	sql += 'CREATE TRIGGER tgr_' + this.name + '_bu '
		+ ' BEFORE UPDATE ON ' + this.name
		+ ' BEGIN\n DELETE FROM ' + this.ftsName() 
		+ ' WHERE docid = old.id;'
		+ '\nEND;\n\n';

	sql += 'CREATE TRIGGER tgr_' + this.name + '_au'
		+ ' AFTER UPDATE ON ' + this.name
		+ ' BEGIN\n INSERT INTO ' + this.ftsName() 
		+ ' (docid, ' + viewFields.join(',') + ') '
		+ ' SELECT id AS docid, ' + viewFields.join(',')
		+ ' FROM ' + this.viewName() + ' WHERE id = new.id;'
		+ '\nEND;\n\n';

	sql += 'CREATE TRIGGER tgr_' + this.name + '_bd '
		+ ' BEFORE DELETE ON ' + this.name
		+ ' BEGIN\n DELETE FROM ' + this.ftsName() 
		+ ' WHERE docid = old.id;'
		+ '\nEND;\n\n';

	return sql;
}

Table.prototype.deleteViewSQL = function() {
	return 'DROP VIEW IF EXISTS ' + this.viewName() + ';\n';
}

Table.prototype.deleteSearchSQL = function() {
	return 'DROP TABLE IF EXISTS ' + this.ftsName() + ';\n'
		+ 'DROP TRIGGER IF EXISTS tgr_' + this.name + '_ai' + ';\n'
		+ 'DROP TRIGGER IF EXISTS tgr_' + this.name + '_bu' + ';\n'
		+ 'DROP TRIGGER IF EXISTS tgr_' + this.name + '_au' + ';\n'
		+ 'DROP TRIGGER IF EXISTS tgr_' + this.name + '_bd' + ';\n'
}

Table.prototype.deleteSQL = function() {
	return 'DROP TABLE IF EXISTS ' + this.name + ';\n';
}

Table.prototype.toJSON = function() {

	var result = {
		name: this.name 
		, row_alias: this.row_alias
		, access_control: this.access_control
		, props: this.props
		, disabled: this.disabled
	};

	result.fields = _.map(this.fieldArray(), function(f) {
		return f.toJSON();
	});

	//console.log(result);
	return result;
}

Table.TABLE_FIELD_SEPARATOR = '$';

exports.Table = Table;

