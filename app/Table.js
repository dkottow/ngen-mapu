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
			throw new Error(errMsg 
					+ " Table names can only have word-type characters.");
		}

		if( ! _.has(tableDef.fields, "id")) {
			throw new Error(errMsg + " id field missing.");
		}

		if( ! _.has(tableDef.fields, "mod_by")) {
			throw new Error(errMsg + " mod_by field missing.");
		}
		if( ! _.has(tableDef.fields, "mod_on")) {
			throw new Error(errMsg + " mod_on field missing.");
		}

		_.each(tableDef.fields, function(f) {
			me.fields[f.name] = Field.create(f);
		});

		me.name = tableDef.name;

		//row alias
		me.row_alias = tableDef.row_alias || [];

		//property values
		me.props = {};

		//copy known props. 
		_.extend(me.props, _.pick(tableDef.props, Table.PROPERTIES));

	}
}

Table.TABLE = '__tableprops__';
Table.TABLE_FIELDS = ['name', 'row_alias', 'props'];

Table.PROPERTIES = ['order', 'label'];

Table.prototype.setProp = function(name, value) {
	if (_.contains(Table.PROPERTIES, name)) {
		this.props[name] = value;
	} else {
		throw new Error(util.format('prop %s not found.', name));
	}
}

Table.CreateTableSQL = "CREATE TABLE " + Table.TABLE + " ("
		+ " name VARCHAR NOT NULL, "
		+ " row_alias VARCHAR, "
		+ "	props VARCHAR, "
		+ "	PRIMARY KEY (name) "
		+ ");\n\n";

Table.prototype.updatePropSQL = function() {

	var sql = "UPDATE " + Table.TABLE 
			+ " SET props = '" + JSON.stringify(this.props) + "'"
			+ " WHERE name = '" + this.name + "'; ";

	_.each(this.fields, function(f) {
		sql += "\n" + f.updatePropSQL(this);
	}, this);

	log.debug({sql: sql}, "Table.updatePropSQL()");
	return sql;
}

Table.prototype.insertPropSQL = function() {

	var values = _.map([
			this.name, 
			JSON.stringify(this.row_alias), 
			JSON.stringify(this.props)
		], function(v) {
		return "'" + v + "'";
	});

	var fields = _.map(Table.TABLE_FIELDS, function(f) {
		return '"' + f + '"';
	});

	var sql = 'INSERT INTO ' + Table.TABLE
			+ ' (' + fields.join(',') + ') ' 
			+ ' VALUES (' + values.join(',') + '); ';

	_.each(this.fields, function(f) {
		sql += "\n" + f.insertPropSQL(this);
	}, this);

	log.debug({sql: sql}, "Table.insertPropSQL()");
	return sql;
}

Table.prototype.field = function(name) {
	var field = this.fields[name];
	if ( ! field) {
		throw new Error(util.format('field %s not found.', name));
	}
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
	return [Field.REF_NAME]
			.concat( _.pluck(_.values(this.fields), 'name'))
			.concat(this.virtualFields());
}

Table.prototype.assertFields = function(fieldNames) {
	var me = this;
	_.each(fieldNames, function(f) {
		if ( ! _.contains(me.viewFields(), f)) {
			throw new Error("unknown field '" + f + "'");
		}			
	});		
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
		name: this.name, 
		row_alias: this.row_alias,
		props: this.props
	};

	result.fields = _.map(this.fields, function(f) {
		return f.toJSON();
	});

	result.fields = _.object(_.pluck(result.fields, 'name'), result.fields);

	//console.log(result);
	return result;
}

exports.Table = Table;

