var _ = require('underscore');
var util = require('util');
var assert = require('assert');

var Field = require('./Field.js').Field;

global.log = global.log || require('bunyan').createLogger({
	name: 'g6.server',
	level: 'debug',
	src: true,
	stream: process.stderr
});

Table = function(tableDef) {

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

		if( ! _.has(tableDef.fields, "modified_by")) {
			throw new Error(errMsg + " modified_by field missing.");
		}
		if( ! _.has(tableDef.fields, "modified_on")) {
			throw new Error(errMsg + " modified_on field missing.");
		}

		_.each(tableDef.fields, function(f) {
			me.fields[f.name] = Field.create(f);
		});

		me.name = tableDef.name;

		//non-SQL attributes
		_.each(Table.PROPERTIES, function(f) {
			me[f] = tableDef[f];
		});

		//parse possible JSON
		if (_.isString(me.row_alias)) {
			me.row_alias = JSON.parse(me.row_alias);
		}
	}
}

Table.TABLE = '__tableprops__';
Table.PROPERTIES = ['row_alias', 'label'];
Table.TABLE_FIELDS = ['name']
		.concat(Table.PROPERTIES);

Table.CreateTableSQL = "CREATE TABLE " + Table.TABLE + " ("
		+ " name VARCHAR NOT NULL, "
		+ "	label VARCHAR, "
		+ " row_alias VARCHAR, "
		+ "	PRIMARY KEY (name) "
		+ ");\n\n";

//properties are read-write attributes of a field.
Table.prototype.sqlValue = function(name) {
	switch(name) {
		case 'row_alias': 
			return this.row_alias
				? "'" + JSON.stringify(this.row_alias) + "'"
				: 'null';
		break;			

		default:
			return this[name]
				? "'" + this[name] + "'"
				: 'null';
	}	
}

Table.prototype.deletePropSQL = function() {
	var sql = "DELETE FROM " + Table.TABLE 
			+ " WHERE name = '" + this.name + "'; "

			+ "DELETE FROM " + Field.TABLE 
			+ " WHERE table_name = '" + this.name + "'; ";

	return sql;
}

Table.prototype.insertPropSQL = function() {

	var values = [ this.sqlValue('name') ];

	var props = _.map(Table.PROPERTIES, function(f) {
		return this.sqlValue(f);
	}, this);

	var fields = _.map(Table.TABLE_FIELDS, function(f) {
		return '"' + f + '"';
	});

	var sql = 'INSERT INTO ' + Table.TABLE
			+ ' (' + fields.join(',') + ') ' 
			+ ' VALUES (' + values.join(',') + ',' + props.join(',') + '); ';

	_.each(this.fields, function(f) {
		sql += "\n" + f.insertPropSQL(this);
	}, this);
	//console.log(sql);
	return sql;
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
		name: this.name
	};

	_.each(Table.PROPERTIES, function(f) {
		result[f] = this[f];
	}, this);

	if (this.parents && this.parents.length > 0) {
		result.parents = _.map(this.parents, function(t) {
			return t.name;
		});
	}

	if (this.children && this.children.length > 0) {
		result.children = _.map(this.children, function(t) {
			return t.name;
		});
	}

	result.fields = _.map(this.fields, function(f) {
		return f.toJSON();
	});

	result.fields = _.object(_.pluck(result.fields, 'name'), result.fields);

	//console.log(result);
	return result;
}

//TODO obsolete
Table.prototype.bfsPath = function(joinTable) {
	//console.log(table.name);
	//console.log(joinTable.name);

	if (this == joinTable) return [this, this];
	var visited = {};
	var queue = [];
	queue.push([this]);
	visited[this.name] = true;
	while ( ! _.isEmpty(queue)) {
		var path = queue.shift();
		var table = _.last(path);
		if (table == joinTable) {
			return path;
		}		

		_.each(table.links, function(lt) {
			if (! visited[lt.name]) {
				visited[lt.name] = true;
				var np = path.slice(0); //copy path
				np.push(lt);
				queue.push(np);
			}
		});
	}
	return []; //not found
}

exports.Table = Table;

