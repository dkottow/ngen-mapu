
//var sqlite3 = require('sqlite3');
var sqlite3 = require('sqlite3').verbose();
var dir = require('node-dir')
var _ = require('underscore')

var fs = require('fs')
var path = require('path')
var util = require('util')


/*
 * buildTableTree constructs a description of tables 
 *
 * input: tables array that describe each table as JSON
 * output: the same tables array 
 *		   modified having a doubly-linked tree structure
 *
 * a table can have one parent table
 * parents are physically linked by foreign keys named parent_pid 
 *
 * in memory we add "forward pointers" to the children as well
 *
 * some tables may have subtypes which are linked one-to-one  
 * by sharing the same primary key
 *
 */
function buildTableTree(tables) {

	var parentTables = _.filter(tables, function(t) {
		return t['parent'] == null;
	});

	var depth = 0;
	while(parentTables.length > 0) {

		var childTables = _.filter(tables, function(t) {
			return _.some(parentTables, function(pt) {
				return pt['name'] == t['parent'];
			});
		});

		_.each(parentTables, function (pt) {

			//obtain rest url
			if (pt['parent']) {

				//change parent attr from name to obj ref
				pt['parent'] = _.find(tables, function(t) {
					return t['name'] == pt['parent'];
				});
			}


			if (pt['subtypes']) {					
				//change subtype (one-to-one) attr from name to obj ref
				pt['subtypes'] = _.map(pt['subtypes'], function(ct) {
					return _.find(tables, function(t) { 
						return t['name'] == ct; 
					});
				});				
			} 
			
			//add children
			pt['children'] = _.filter(tables, function(t) {
				return t['parent'] == pt['name'] 
					&&  ! _.contains(pt['subtypes'], t);
			});

		});

		parentTables = childTables;
	}
}

function buildSelectSql(filterFields, filterAncestor, table, fields) {

	if (fields == '*') {
		fields = _.map(table['fields'], function(f) {
			return util.format('%s."%s"', table['name'], f['name']);
		});
	}

	var sql = "SELECT " + fields.join(",") + " FROM " + table['name'];

	var joins = ""
	  , where = " WHERE 1=1"
	  , sql_params = [];

	if (_.keys(filterAncestor).length > 0) {
		var ancestorTable = _.keys(filterAncestor)[0];
		var ancestorId = filterAncestor[ancestorTable];
		var hasAncestor = false;

		var t = table;
		while(t['parent']) {
			var pt = t['parent'];
			var pid_name = pt['name'] + "_pid";

			if (pt['subtypes']) {
				//one-one to parent
				joins = joins + util.format(" INNER JOIN %s ON %s.id = %s.id", pt['name'], pt['name'], t['name']);

			} else {
				joins = joins + util.format(" INNER JOIN %s ON %s.%s = %s.id", pt['name'], t['name'], pid_name, pt['name']);

			}
	
			if (pt['name'] == ancestorTable) {
				where = where + " AND " + ancestorTable + ".id = ?";
				sql_params.push(ancestorId);
				hasAncestor = true;
				break;
			}
		
			//console.log(joins, where);
			t = pt;
		}
		if ( ! hasAncestor) {
			//no ancestor found - don't join tables
			joins = "";
		}
	}

	_.each(filterFields, function(v,k) {
		where = where + ' AND ' + k + ' = ?';
		sql_params.push(v);	
	});

	sql = sql + joins + where;
	console.log(sql, sql_params);
	return {'query': sql, 'params': sql_params};
}

function Model(dbFile) 
{
	this.dbFile = dbFile;
	this.tables = [];

	this.init = function(cbAfter) {
		var me = this;
		var db = new sqlite3.cached.Database(this.dbFile);

		db.get("SELECT value FROM _defs_ WHERE name = $name"
			, {$name : "tables"}
			, function(err, row) {
				if (err) console.error(err);
				me.tables = JSON.parse(row.value);

				var doAfter = _.after(me.tables.length, function() {
					buildTableTree(me.tables);	
					cbAfter();
				});

				_.each(me.tables, function(t) {

					db.all(util.format("PRAGMA table_info(%s)", t['name'])
							, function(err, rows) {
						if (err) console.error(err);
						t['fields'] = _.object(_.pluck(rows, "name"), rows);
						//console.dir(t);

						doAfter();					
					});
					
				});
		});
	}


	this.defs = function() {
		var tableDefs = _.map(this.tables, function(table) {
			//replace parent, subtypes table refs with table names
			var t = _.clone(table);
			if (t['parent']) t['parent'] = t['parent']['name'];
			if (t['subtypes']) {
				var subtypes = t['subtypes'];
				t['subtypes'] = []
				_.each(subtypes, function(ct) {
					t['subtypes'].push(ct['name']);
				});
			}
			
			var children = t['children'];
			t['children'] = [];
			_.each(children, function(ct) {
				t['children'].push(ct['name']);
			});

			//t['fields'] = JSON.stringify(t['fields']);

			return t;
		});

		//TODO do SELECT count(*) UNION ALL foreach table 
		//to add row counts.

		
		return _.object(_.pluck(tableDefs, 'name'), tableDefs);
	}

	this.all = function(filterFields, filterAncestor, table, fields, cbResult) {
		var sql = buildSelectSql(filterFields, filterAncestor, table, fields);

		var db = new sqlite3.cached.Database(this.dbFile);

		db.all(sql['query'], sql['params'], function(err, rows) {
			if (err) console.error(err);
			//console.dir(rows);
			cbResult(rows);
		});
		
	}

	this.get = function(filterFields, filterAncestor, table, fields, cbResult) {
		var sql = buildSelectSql(filterFields, filterAncestor, table, fields);

		var db = new sqlite3.cached.Database(this.dbFile);

		db.get(sql['query'], sql['params'], function(err, row) {
			if (err) console.error(err);
			//console.dir(rows);
			cbResult(row);
		});
	}

	this.insert = function(table, rows, cbDone) {

		if (rows.length == 0) return;
		var fieldNames = _.filter(_.map(table['fields']
								, function(f) { return f['name']; })		
							, function(fn) { return fn != 'id'; });

		var fieldParams = _.map(fieldNames, function(fn) { return "?"; });

		var sql = "INSERT INTO " + table['name'] 
				+ "(" + fieldNames.join(', ') + ")" 
				+ " VALUES (" + fieldParams.join(', ') + ")";

		//console.log(sql);
		var ids = [];
		var db = new sqlite3.Database(this.dbFile);
		
		db.serialize(function() {

			var stmt = db.prepare(sql);
			_.each(rows, function(r) {

				var params = _.map(fieldNames, function(fn) { return r[fn]; });
				//console.log(params);
				stmt.run(params, function(err) { 
					if (err) console.error(err);
					ids.push(this.lastID);
				});
			});
			stmt.finalize(function() { cbDone(ids); });	

		});
		db.close();
	}

	this.update = function(table, rows, cbDone) {

		if (rows.length == 0) return;
		var fieldNames = _.filter(_.map(table['fields']
								, function(f) { return f['name']; })		
							, function(fn) { return fn != 'id'; });

		var sql = "UPDATE " + table['name'] 
			+ " SET " + fieldNames.join(' = ?, ') + " = ?"
			+ " WHERE id = ?"; 

		//console.log(sql);
		var modCount = 0;	
		var db = new sqlite3.Database(this.dbFile);

		db.serialize(function() {

			var stmt = db.prepare(sql);
			_.each(rows, function(r) {

				var params = _.map(fieldNames, function(fn) { return r[fn]; });
				params.push(r['id']);
				//console.log(params);
				stmt.run(params, function(err) {
					if (err) console.error(err);
					modCount += this.changes;
				});
			});
			stmt.finalize(function() { cbDone(modCount); });	

		});
		db.close();
	}

}

exports.Model = Model;

