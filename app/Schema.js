var  fs = require('fs')
  	, _ = require('underscore')
  	, util = require('util')
	, assert = require('assert');

var sqlite3 = require('sqlite3').verbose();

if (global.log) {
	var log = global.log.child({'mod': 'g6.schema.js'});
	var row_max_count = global.row_max_count;
} else {
	//e.g when testing 
	var log = require('bunyan').createLogger({
				'name': 'g6.schema.js', 'level': 'debug'
		});
}

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

		if ( ! /^\w+$/.test(fieldDef.name)) {
			throw new Error(errMsg 
					+ " Field names can only have word-type characters.");
		}

		if ( ! _.isNumber(fieldDef.order)) {
			throw new Error(errMsg + " Field order must be an integer");
		}

		me.type = fieldDef.type;
		me.order = fieldDef.order;
		me.notnull = fieldDef.notnull;
		me.fk = 0;
		me.fk_table = fieldDef.fk_table;
		if (me.fk_table) {
			me.fk = 1;
			me.fk_field = "id";
		}
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

schema.Field.prototype.toJSON = function() {
	var result = {
		name: this.name,
		type: this.type,
		order: this.order,
		fk: this.fk
	};
	if (result.fk == 1) {
		result.fk_table = this.fk_table; 
	}
	return result;
}

schema.Field.prototype.refName = function() {
	return this.fk_table +'_ref';
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
			me.fields[f.name] = createField(f);
		});

		me.name = tableDef.name;
		me.row_name = tableDef.row_name;

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

schema.Table.prototype.foreignKeys = function() {
	return _.select(this.fields, function(f) { 
		return f.fk == 1; 
	});
}

schema.Table.prototype.viewName = function() { return 'v_' + this.name; }
schema.Table.prototype.ftsName = function() { return 'fts_' + this.name; }

schema.Table.prototype.virtualFields = function() {

	return _.map(this.foreignKeys(), function(f) { 
		return f.refName();
	});
}

schema.Table.prototype.viewFields = function() {
	return _.pluck(_.values(this.fields), 'name')
			.concat(this.virtualFields());
}

schema.Table.prototype.toSQL = function() {
	var sql = "CREATE TABLE " + this.name + "(";
	_.each(this.fields, function(f) {
		sql += "\n" + f.toSQL() + ",";
	});
	sql += "\n PRIMARY KEY (id)";


	_.each(this.foreignKeys(), function(fk) {
		sql += ",\n FOREIGN KEY(" + fk.name + ") REFERENCES " 
			+ fk.fk_table + " (id)";
	});

	sql += "\n);";
	log.debug(sql);

	return sql;
}

/* 

use triggers to populate https://github.com/coolaj86/sqlite-fts-demo

sqlite> create trigger orders_ai after insert on orders begin    
...>    insert into fts_orders (docid,content) select id as docid, customers_ || ' yes' as content from v_orders where id = new.id; 
...>end;

*/

schema.Table.prototype.createSearchSQL = function()
{
	var viewFields = this.viewFields();

	var sql = 'CREATE VIRTUAL TABLE  ' + this.ftsName() 
			+ ' USING fts4(' +  viewFields.join(',') + ');\n\n';

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



schema.Table.prototype.toJSON = function() {

	var result = {
		name: this.name,
		row_name: this.row_name
	}
	
	if (this.supertype && this.supertype.length > 0) {
		result.supertype = this.supertype.name;
	}

	if (this.parents && this.parents.length > 0) {
		result.parents = _.map(this.parents, function(t) {
			return t.name;
		});
	}
	
	if (this.subtypes && this.subtypes.length > 0) {
		result.subtypes = _.map(this.subtypes, function(t) {
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

	if (result.supertype) {
		//describe virtual <supertype>_sid field

		var sid_order = result.fields.id.order + 1;

		var sid_order_taken = _.find(result.fields, function(f) {
			return f.order == sid_order;
		});

		if (sid_order_taken) {
			//sid field place is taken, make space.
			_.each(result.fields, function(f) {
				if (f.order >= sid_order) {
					f.order = f.order + 1;
				}
			});
		}

		var sid = result.supertype + "_sid";
		result.fields[sid] = { 
			"order": sid_order,
			"name": sid,
			"type": "INTEGER",
			"notnull": 1,
			"pk": 0,
			"fk": 1,
			"fk_table": result.supertype,
			"fk_field": "id",
			"row_name": 0
		};

		//mark id field as non-fk
		result.fields.id.fk = 0;
	}
	return result;
}

schema.Table.prototype.bfsPath = function(joinTable) {
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

schema.Database = function(tableDefs) {

	this.tableDefs = tableDefs;
	this.tables = {};
	this.linkedTableLists = [];
}

schema.Database.prototype.init = function(cbAfter) {
	try {
		var me = this;
		//console.log(util.inspect(me.tableDefs));
		_.each(me.tableDefs, function(tableDef) {
			var table = new schema.Table(tableDef);
			me.tables[table.name] = table;			

		});
		this.buildTableGraph();
		//console.log(util.inspect(me.tables, {depth: 99}));
		cbAfter();

	} catch(err) {
		//throw err;
		cbAfter(err);
	}
}

schema.Database.prototype.buildTableGraph = function() {

	var me = this;
	var tables = _.values(me.tables);

	log.debug("Building table graph. Got " + tables.length + " tables.");

	_.each(tables, function(table) {

		var fks = _.filter(table.fields, function(f) {
			return f.fk == 1 && f.name != 'id';
		});

		table.parents = _.filter(tables, function(t) {
			return _.contains(_.pluck(fks, 'fk_table'), t.name);
		});

		if (table.fields['id'].fk == 1) {
			table.supertype = _.find(tables, function(t) {
				return table.fields['id'].fk_table == t.name;
			});
			//unmark id as fk
			//table.fields['id'].fk = 0;
		}
		//log.debug(table);
	});
	_.each(tables, function(table) {

		table.children = _.filter(tables, function(t) {
			return _.contains(_.pluck(t.parents, 'name'), table.name);
		});

		table.subtypes = _.filter(tables, function(t) {
			return t.supertype && t.supertype.name == table.name;
		});
		
		table.links = table.parents;
		table.links = table.links.concat(table.children);
		table.links = table.links.concat(table.subtypes);
		if (table.supertype) table.links.push(table.supertype);
		
	});

	var linkedTables = [];
	_.each(tables, function(table) {
		
		var linked = false;
		_.each(linkedTables, function(list) {
			if (! linked) {
				var p = table.bfsPath(me.tables[list[0]]);
				if (p.length > 0) {
					list.push(table.name);
					linked = true;
				}
			}
		});	

		if (! linked) {
			var list = [table.name];
			linkedTables.push(list);
		}		
	});
	//console.log(linkedTables);
	this.linkedTableLists = linkedTables;
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


function tableAlias(name) {
	return name + '_';
}

schema.Table.prototype.alias = function() {
	return tableAlias(this.name);
}

schema.Database.prototype.viewSQL = function(table) {
	var me = this;
	
	var joinTables = {};
	var joinSQL = '';
	var distinct = false;
	var fk_fields = [];
	_.each(table.foreignKeys(), function(fk) {
			
		var fk_table = me.tables[fk.fk_table];
		var nkValue = _.reduce(fk_table.row_name, function(memo, nk) {
			var result;
			
			if (nk.indexOf('.') < 0) {
				var fkTableName = (table == fk_table) ?
									table.alias() : fk_table.name;
				
				result = util.format('%s."%s"', fkTableName, nk);
				var path = table.bfsPath(fk_table);
				var j = joinTablePath(path, joinTables);
				joinSQL = joinSQL + j.sql;
				for(var i = 1; i < path.length; ++i) {
					joinTables[path[i].name] = path[i];
				}
			} else {
				var nkTable = nk.split('.')[0]; 	
				var nkField = nk.split('.')[1]; 	
				result = util.format('%s."%s"', nkTable, nkField);

				var path = table.bfsPath(me.tables[nkTable]);
				var j = joinTablePath(path, joinTables);
				joinSQL = joinSQL + j.sql;
				for(var i = 1; i < path.length; ++i) {
					joinTables[path[i].name] = path[i];
				}
			}	
			if ( ! _.isEmpty(memo)) {
				result = memo + " || ' ' || " + result;
			}
			return result;
		}, '');
		fk_fields.push(nkValue + ' AS ' + fk.refName());
			
	});

	var fieldSQL = _.map(table.fields, function(f) {
		return util.format('%s."%s"', table.name, f.name);
	}).join(',');

	if (fk_fields.length > 0) {
		fieldSQL = fieldSQL + ',' + fk_fields.join(',');
	}

	return 'CREATE VIEW ' + table.viewName() 
		+  ' AS SELECT ' + fieldSQL + ' FROM ' + table.name 
		+ joinSQL + ';';
}

schema.Database.prototype.createSQL = function() {
	var me = this;
	var sql = createDefTables();

	_.each(this.tables, function(t) {
		sql += t.toSQL() + '\n\n';
		sql += me.viewSQL(t) + '\n\n';
		sql += t.createSearchSQL() + '\n\n';
		sql += t.insertDefSQL() + '\n\n';
	});

	return sql;
}

schema.Database.prototype._generateDatabase = function(dbFile, cbResult) {
	var sql = this.createSQL();

	var execSQL = function(err, db) {
		if ( ! err) {
			db.exec(sql, function(err) {
				db.close();
				cbResult(err);
			});							
		} else {
			cbResult(err);
		}
	}

	if (dbFile) {
		var db = new sqlite3.Database(dbFile 
			, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE
			, function(err) {
				execSQL(err, db);
		});
	} else {
		var db = new sqlite3.Database(":memory:");
		execSQL(null, db);
	}

}

schema.Database.prototype.get = function() {

	assert(_.isObject(this.tables)); 
	
	var tableDefs = _.map(this.tables, function(table) {
		return table.toJSON();
	});

	tableDefs = _.object(_.pluck(tableDefs, 'name'), tableDefs);
	return {
		'tables': tableDefs,
		'joins': this.linkedTableLists
	};		
}

schema.Database.prototype.filterSQL = function(table, filterClauses) {

	var useView = true;
	var joinTables = {};
	var joinSQL = '';

	var me = this;

	var whereSQL = " WHERE 1=1";
	var distinct = false;
	var sql_params = [];

	_.each(filterClauses, function(filter) {

		filter.table = filter.table || table.name;

		var allowedFilterFieldNames = (filter.table == table.name) ? 
				table.viewFields() : 
				_.pluck(me.tables[filter.table].fields, 'name');

		allowedFilterFieldNames.push(filter.table);

		assert(_.contains(allowedFilterFieldNames, filter.field), 
			util.format("filter field %s.%s unknown", 
				filter.table, filter.field));

		if (filter.table != table.name) {

			var path = table.bfsPath(me.tables[filter.table]);
			var j = joinTablePath(path, joinTables);
			
			var jSQL = j.sql;
			if (useView) {
				var r = new RegExp('\\b' + table.name + '\\b', 'g');
				jSQL = j.sql.replace(r, table.viewName());
			}			

			joinSQL = joinSQL + jSQL;
			distinct = distinct || j.distinct;
			for(var i = 1; i < path.length; ++i) {
				joinTables[path[i].name] = path[i];
			}
		}

		if (filter.operator == 'search') {
			var filterTable = (filter.table == table.name && useView) ?
								table.viewName() : filter.table;

			joinSQL = joinSQL + ' INNER JOIN ' 
					+ me.tables[filter.table].ftsName()
					+ ' ON ' + util.format('%s.docid = %s.id', 
									me.tables[filter.table].ftsName(),
									filterTable);
		}

		if (filter.operator && filter.value) {

			var scalarClauses = { 'eq' : '=', 
								  'ge': '>=', 
								  'gt': '>', 
								  'le': '<=', 
								  'lt': '<',
								  'search': 'MATCH' };
			
			//TODO - IN operator?

			assert(_.has(scalarClauses, filter.operator),
				util.format("filter clause %s unknown",  
					filter.operator));

			var filterTable;
			var filterField = filter.field;

			if (filter.operator == 'search') {
				filterTable = me.tables[filter.table].ftsName();
				if (filterField == filter.table) filterField = filterTable;
			} else if (filter.table == table.name && useView) {
				filterTable = table.viewName();
			} else {
				filterTable = filter.table;
			}

			whereSQL = whereSQL + util.format(" AND %s.%s %s ?", 
					filterTable, filterField, 
					scalarClauses[filter.operator]);
				
			sql_params.push(filter.value);
		}
	});

	return { 
		join: joinSQL,
		where: whereSQL,
		distinct: distinct,
		params: sql_params
	};
}

schema.Database.prototype.selectSQL = function(table, filterClauses, fields, orderClauses, limit) {
	assert(_.isArray(filterClauses), "arg 'filterClauses' is array");
	assert(_.isObject(table), "arg 'table' is object");
	assert(_.isArray(orderClauses), "arg 'orderClauses' is array");
	
	var useView = true;
	var tableName = useView ? table.viewName() : table.name;

	if (fields == '*') {
		fields = _.map(table.fields, function(f) {
			return util.format('%s."%s" as %s', tableName, f.name, f.name);
		});
		if (useView) {
			var fk_fields =_.map(table.foreignKeys(), function(f) {
				return util.format('%s."%s" as %s', 
							tableName, f.refName(), f.refName());
			});
			fields = fields.concat(fk_fields);
		}
	}		
	//log.debug(fields);
	assert(_.isArray(fields), "arg 'fields' is array");
	
	if (_.isNumber(limit)) limit = limit.toString();
	assert(_.isString(limit), "arg 'limit' is string");

	var filterSQL = this.filterSQL(table ,filterClauses);

	var orderSQL;
	if ( ! _.isEmpty(orderClauses)) {	
		
		var orderSQL = _.reduce(orderClauses, function(memo, order, idx) {
			var orderField = _.keys(order)[0];
			var orderDir = _.values(order)[0].toUpperCase();
			
			assert(_.contains(table.viewFields(), orderField),
				  util.format("order field '%s' unknown", orderField));

			assert(_.contains(['ASC', 'DESC'], orderDir),
				  util.format("order dir '%s' invalid", orderDir));
			
			var result = memo + util.format('%s."%s" %s', 
							tableName, orderField, orderDir);

			if (idx < orderClauses.length-1) result = result + ',';
			return result;
			
		}, ' ORDER BY ');
		
	} else {
		//most recently modified first
		orderSQL = " ORDER BY " + tableName + ".id DESC";
	}


	var limitSQL = " LIMIT " + row_max_count;
	if (limit.indexOf(',') > 0) {
		var ab = limit.split(",");
		var a = parseInt(ab[0]);
		var b = parseInt(ab[1]);
		if ( !_.isNaN(a) && !_.isNaN(b)) {
			limitSQL = util.format(" LIMIT %d, %d", a, b);
		}
	} else {
		var a = parseInt(limit);
		if (!_.isNaN(a)) {
			limitSQL = util.format(" LIMIT %d", a);
		}
	}

	var fieldSQL = fields.join(",");

	var sql = "SELECT ";
	if (filterSQL.distinct) sql = sql + "DISTINCT ";
	sql = sql + fieldSQL + " FROM " + tableName 
			+ " " + filterSQL.join + filterSQL.where + orderSQL + limitSQL;

	log.debug(sql, filterSQL.params);

	var countSQL = "SELECT COUNT("
	if (filterSQL.distinct) countSQL = countSQL + "DISTINCT ";
	countSQL = countSQL + tableName + ".id) as count FROM " + tableName 
			+ " " + filterSQL.join + filterSQL.where;

	return {'query': sql, 'params': filterSQL.params, 'countSql': countSQL};
}

schema.Database.prototype.save = function(dbFile, cbResult) {
	log.debug("schema.Database.save " + dbFile)
	var me = this;
	me._generateDatabase(null, function(err) {
		if ( ! err) {
			me._generateDatabase(dbFile, function(err) {
				log.info("saving db to " + dbFile)
				if (err) {
					log.warn("save() failed. " + err);			
				}
				cbResult(err);
			});		
		} else {
			log.warn("save() failed. " + err);			
			cbResult(err);
		}
	});
}

schema.Database.remove = function(dbFile, cbResult) {
	fs.unlink(dbFile, function(err) {
		if (err) {
			log.warn("remove() failed. " + err);			
		}
		cbResult(err);
	});
}

function joinTablePath(tables, exclude) {
	var joinClause = "";
	var distinct = false;
	for(var i = 0;i < tables.length - 1; ++i) {
		var t = tables[i];
		var pt = tables[i+1];

		if (exclude[pt.name]) continue; 

		//this finds supertypes as well
		var fk = _.find(t.fields, function(f) {
			return f.fk_table == pt.name;
		});

		if (fk) {
			// pt is parent or supertype			
			var ptName = pt.name;
			if (t == pt) {
				joinClause = joinClause 
				  + util.format(" INNER JOIN %s as %s ON %s.%s = %s.id", 
								pt.name, tableAlias(pt.name),
								t['name'], fk.name, 
								tableAlias(pt.name));
			} else {
				joinClause = joinClause 
				  + util.format(" INNER JOIN %s ON %s.%s = %s.id", 
								pt.name, 
								t['name'], fk.name, 
								pt.name);
			}

		} else {
			// pt is child or subtype			
			var pfk = _.find(pt.fields, function(pf) {
				return pf.fk_table == t.name;
			});

			joinClause = joinClause 
				  + util.format(" INNER JOIN %s ON %s.%s = %s.id", 
								pt['name'], 
								pt['name'], pfk.name, 
								t['name']);
			distinct = true;
		}
			
		//console.log(joinClause);
	}
	return { 'sql': joinClause, 'distinct': distinct };
}


exports.Schema = schema.Database;

