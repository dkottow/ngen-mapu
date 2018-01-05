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

/*
var FieldFactory = require('./FieldFactory.js').FieldFactory;
var Field = FieldFactory.class();
*/
var SqlHelper = require('./SqlHelperFactory.js').SqlHelperFactory.create();
var SchemaDefs = require('./SchemaDefs.js').SchemaDefs;
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
			throw new Error("Table.init() failed."
					+ " Table names can only have word-type characters.");
		}

		var fields = _.values(tableDef.fields) || [];

		var fieldNames = _.pluck(fields, 'name');
		var missFields = _.filter(Table.MANDATORY_FIELDS, function(mf) {
			return ! _.contains(fieldNames, mf.name);
		});
		
		fields = fields.concat(missFields);
		
		_.each(fields, function(f) {
			try {
				me._fields[f.name] = Field.create(f);
			} catch(err) {
				log.warn({field: f, err: err}, 
					"Field.create() failed. Ignoring field '" + f.name + "'");
			}
		});

		me.name = tableDef.name;

		_.each(Table.SYSTEM_PROPERTIES, function(p) {
			if (tableDef.hasOwnProperty(p)) {
				me[p] = tableDef[p];	
			} else {
				me[p] = Table.SYSTEM_PROPERTY_DEFAULTS[p];
			}
		});

	}
}

Table.MANDATORY_FIELDS = [
	{ name: 'id', type: 'integer' }
	, { name : 'own_by', type: 'text(256)' }
	, { name : 'mod_by', type: 'text(256)' }
	, { name : 'mod_on', type: 'timestamp' }
	, { name : 'add_by', type: 'text(256)' }
	, { name : 'add_on', type: 'timestamp' }
];

Table.ROW_SCOPES = {
	NONE: "none",
	OWN: "own",
	ALL: "all" 
}

Table.ALL_FIELDS = '*';

Table.TABLES = {
	ACCESS : '__d365TableAccess'
};

Table.FIELDS = {
	ACCESS_TABLE : 'TableName',
	ACCESS_READ: 'Read',
	ACCESS_WRITE: 'Write'
};

Table.SYSTEM_PROPERTIES = ['row_alias', 'disabled'];
Table.SYSTEM_PROPERTY_DEFAULTS = {
	row_alias: [],
	disabled: false
};

Table.prototype.setProp = function(name, value) {
	this.props = this.props || {};
	this.props[name] = value;
}


Table.prototype.fields = function() {
	return this._fields; //returns object with key == field.name
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

Table.rowAliasView = function(name, idx) {
	if (idx) return '_d365_' + name + ('00' + idx).substr(-2);
	else return '_d365_' + name;
}

Table.prototype.rowAliasView = function(idx) { 
	return Table.rowAliasView(this.name, idx); 
}

Table.prototype.ftsName = function() { return 'fts_' + this.name; }

Table.prototype.refFields = function() {
	var fkRefs = _.map(this.foreignKeys(), function(f) { 
		return f.refName();
	});
	return [ Field.ROW_ALIAS ].concat(fkRefs);
}

Table.prototype.viewFields = function() {
	var result = this.enabledFields().concat(this.refFields());
	log.trace({result: result}, '...Table.viewFields()');
	return result;
}

Table.prototype.enabledFields = function() {
	var enabledFields = _.filter(this.fields(), function(f) {
		return f.disabled != true;
	});

	return _.pluck(enabledFields, 'name');
}


/*
Table.prototype.refFields = function() {

	var refField = util.format('%s.%s'
				, this.rowAliasView()
				, Field.ROW_ALIAS);

	var fkRefs = _.map(this.foreignKeys(), function(fk) {
		return util.format('%s.%s'
				, Table.rowAliasView(fk.fk_table)
				, Field.ROW_ALIAS)
	});
	
	var result = [refField].concat(fkRefs);

	return result;
}
*/

/*
function tableAlias(name, idx) {
	return name + '_' + idx;
}

Table.prototype.alias = function(idx) {
	return tableAlias(this.name, idx);
}
*/

Table.prototype.allFieldClauses = function() {
	return _.map(this.viewFields(), function(vf) {
		return { table: this.name, field: vf };
	}, this);
}


Table.prototype.toJSON = function() {

	var result = {
		name: this.name 
	};

	_.each(Table.SYSTEM_PROPERTIES, function(p) {
		result[p] = this[p];
	}, this);

	result.fields = _.mapObject(this.fields(), function(field) {
		return field.toJSON();
	});

	//console.log(result);
	return result;
}

Table.prototype.createSQL = function() {
	var sql = 'CREATE TABLE ' + this.name + '(';
	_.each(this.fields(), function(field) {
		sql += '\n' + field.toSQL(this) + ',';
	}, this);
	sql += '\n' + SqlHelper.Table.createPrimaryKeySQL(this.name);
	sql += "\n);";

	log.trace(sql);
	return sql;
}

Table.prototype.addFieldSQL = function(field) {
	var sql = "ALTER TABLE " + this.name 
		+ " ADD " + field.toSQL(this) + ";\n";

	log.trace(sql);
	return sql;
}

Table.prototype.rowAliasSQL = function(idx) {
	var result = {
		table: this.rowAliasView(idx),
		clause: util.format('%s.id = %s.id'
					, this.rowAliasView(idx)
					, this.name)
	}
	if (idx) {
		result.alias = this.rowAliasView(idx);
	}
	return result;
}

Table.prototype.fkAliasSQL = function(fk, idx) {
	
	var result = {
		table: Table.rowAliasView(fk.fk_table),
		clause: util.format('%s.id = %s.%s'
					, Table.rowAliasView(fk.fk_table, idx) 
					, this.name
					, SqlHelper.EncloseSQL(fk.name))
	};
	if (idx) {
		result.alias = Table.rowAliasView(fk.fk_table, idx);
	}
	return result;	
}

Table.prototype.dropViewSQL = function() {
	return 'DROP VIEW IF EXISTS ' + this.rowAliasView() + ';\n'
}

Table.prototype.dropSQL = function() {
	return 'DROP TABLE ' + this.name + ';\n\n';
}

Table.prototype.deletePropSQL = function() {
	var sql = util.format("DELETE FROM %s WHERE %s = '%s'", 
		SchemaDefs.PROPERTIES_TABLE,
		SchemaDefs.PROPERTIES_FIELDS.table,
		this.name
	);
	return sql;
}

Table.prototype.systemPropertyRows = function() {
	var rows = [];


	_.each(Table.SYSTEM_PROPERTIES, function(name) {

		var propVal = JSON.stringify(this[name]);
		var defVal = JSON.stringify(Table.SYSTEM_PROPERTY_DEFAULTS[name]);
		if (propVal != defVal) {
			var row = {};	
			row[SchemaDefs.PROPERTIES_FIELDS.table] = this.name;
			row[SchemaDefs.PROPERTIES_FIELDS.name] = name;
			row[SchemaDefs.PROPERTIES_FIELDS.value] = propVal;
			rows.push(row);
		}

	}, this);

	_.each(this.fields, function(field) {
		rows = rows.concat(field.systemPropertyRows(this));
	}, this);
	
	return rows;
}

Table.TABLE_FIELD_SEPARATOR = '$';

exports.Table = Table;

