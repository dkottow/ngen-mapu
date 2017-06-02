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

var  fs = require('fs');
var  path = require('path');
var _ = require('underscore');
var util = require('util');

var TableGraph = require('./TableGraph.js').TableGraph;

/*
var TableFactory = require('./TableFactory.js').TableFactory;
var Table = TableFactory.class();
*/

var SqlHelper = require('./SqlHelperFactory.js').SqlHelperFactory.create();
var Table = require('./Table.js').Table;


var log = require('./log.js').log;

var Schema = function() {
	this.graph = null;
}

Schema.EMPTY = {
	name: ''
	, tables: []
	, join_trees: []
	, users: []
}

Schema.ADMIN_ROLE = "owner";

Schema.USER_ROLES = {
	OWNER: "owner",
	WRITER: "writer",
	READER: "reader"
};

Schema.TABLE = '__schemaprops__';

Schema.prototype.init = function(schemaData) {
	try {
		log.trace('Schema.init()...');
		log.trace({data: schemaData});
		
		schemaData = schemaData || Schema.EMPTY;
		
		var tables = _.map(schemaData.tables, function(tableDef) {
			return new Table(tableDef);
		});

		var options = _.pick(schemaData, 'join_trees');
		this.graph = new TableGraph(tables, options);
		this.users = schemaData.users || [];
		this.name = schemaData.name;

		log.trace('...Schema.init()');

	} catch(err) {
		log.error({err: err, data: schemaData}, "Schema.init() exception.");
		throw err;
	}
}

Schema.prototype.get = function() {

	try {
		var result = this.graph.toJSON();
		result.name = this.name;
		result.users = this.users; 
		return result;
		
	} catch(err) {
		log.error({err: err}, "Schema.get() exception.");
		throw err;
	}
}

/******* table ops *******/

Schema.prototype.tables = function() {
	var tables = this.graph.tables();
	return _.object(_.pluck(tables, 'name'), tables);
}

Schema.prototype.table = function(name) { 
	return this.tables()[name];
}

Schema.prototype.setTable = function(table) { 
	return this.addTable(table);
}

Schema.prototype.addTable = function(table, options) { 
	if ( ! table instanceof Table) 
		throw new Error('Type mismatch error on addTable'); 

	var schemaData = this.get();
	var replace = schemaData.tables.hasOwnProperty(table.name);
	schemaData.tables[table.name] = table.toJSON();
	if ( ! replace) delete schemaData.join_trees;  //resets to default (minimum spanning tree)
	this.init(schemaData);	
}

Schema.prototype.removeTable = function(name) { 
	log.info({name: name},'Schema.removeTable()');
	var schemaData = this.get();
	delete schemaData.tables[name];
	_.each(schemaData.tables, function(table) {
		// remove fk's (in mem) that reference deleted table 
		var staleForeignKeys = _.filter(table.fields, function(field) {
			return field.fk && field.fk_table == name; 
		});
		_.each(staleForeignKeys, function(fk) { delete fk.fk_table; });
	});
	delete schemaData.join_trees; //resets to default (minimum spanning tree)
	this.init(schemaData);	
}

/******* user ops *******/


Schema.prototype.user = function(name) {
	var user = _.find(this.users, function(u) { 
		return u.name == name; 
	});
	return user;
}

Schema.prototype.setUser = function(name, role) {
	if (!role) {
		delete this.users[name];
		return;
	}
	//TODO get rid of fixed roles..
	if ( ! _.contains(Schema.USER_ROLES, role)) { 
		throw new Error(util.format('user role %s unknown.', role));
	}
	var user = this.user(name);
	if (user) user.role = role;
	else this.users.push({name: name, role:role});
}

//used in ApiController, smells bad..
Schema.setAdmin = function(schemaDef, name) {
	schemaDef.users = schemaDef.users || [];
	if (_.findIndex(schemaDef.users, { name : name }) < 0) {
		schemaDef.users.push({name: name, role: Schema.ADMIN_ROLE });
	}
}

/******* file ops *******/


Schema.prototype.jsonWrite = function(fileName, cbAfter) {
	var me = this;
	try {
		var data = _.pick(this.get(), _.keys(Schema.EMPTY));
		fs.writeFile(fileName, JSON.stringify(data), function(err) {
			if (err) {
				log.error({data: data, error: err}
					, "Schema.jsonWrite() failed. Could not write to '" 
					+ fileName + "'");
				cbAfter(err);
				return;
			}

			cbAfter();
		});

	} catch(err) {
		log.error({err: err}, "Schema.jsonWrite() exception.");
		cbAfter(err);
	}
}

Schema.prototype.jsonRead = function(fileName, cbAfter) {
	var me = this;
	try {

		fs.readFile(fileName, 'utf8', function(err, data) {
			if (err) {
				log.error({err: err, file: fileName}, 
					"Schema.jsonRead() failed. Could not open file.");
				cbAfter(err);
				return;
			}

			try {
				data = JSON.parse(data);

			} catch(err) {
				log.error({err: err, data: data}, 
					"Schema.jsonRead() parse error.");
				cbAfter(err);
				return;
			}

			me.init(data);
			cbAfter();
			
		});

	} catch(err) {
		log.error({err: err, file: fileName}, 
			"Schema.jsonRead() exception.");
		cbAfter(err);
	}
}

// private methods..


Schema.prototype.applyChanges = function(changes) {

	_.each(changes, function(change) {
		try {
			log.debug({
				op: change.op, 
				path: change.path, 
				patchObj: change.patchObj, 
				changeObj: change.changeObj 
			}, 'apply()');
			
			if (change.schema != this) {
				throw new Error('Schema mismatch. Internal Error.');
			}
			change.apply();
		} catch(err) {
			log.error({err: err, change: change}, 
					"Schema.applyChanges() exception.");
			throw err;		
		}
	}, this);
	
	this.init(this.get()); //rebuild objs from json (e.g. TableGraph)
}


Schema.TABLE = "__schemaprops__";
Schema.TABLE_FIELDS = ['name', 'value'];

//Schema.PROPERTIES = [];

Schema.prototype.persistentProps = function() {
	var props = { 
		join_trees: this.graph.joinTreesJSON(),
		users: this.users
	};
	return props;
}

Schema.prototype.updatePropSQL = function(opts) {

	opts = opts || {};
	var deep = opts.deep || false;

	var sql = _.map(this.persistentProps(), function(v, k) {
		return "UPDATE " + Schema.TABLE 
			+ " SET value = '" + JSON.stringify(v) + "'"
			+ " WHERE name = '" + k + "'; ";		
	}).join('\n');

	if (deep) {
		_.each(this.tables(), function(t) {
			sql += "\n" + t.updatePropSQL(opts);
		}, this);
	}

	log.debug({sql: sql}, "Schema.updatePropSQL()");
	return sql;
}

Schema.prototype.insertPropSQL = function(opts) {

	opts = opts || {};
	var deep = opts.deep || false;

	var values = _.map(this.persistentProps(), function(v, k) {
		return "('" + k + "', '" + JSON.stringify(v) + "')";
	});

	var fields = _.map(Schema.TABLE_FIELDS, function(f) {
		return '"' + f + '"';
	});

	var sql = 'INSERT INTO ' + Schema.TABLE
			+ ' (' + fields.join(',') + ') ' 
			+ ' VALUES ' + values.join(',') + '; ';

	if (deep) {
		_.each(this.tables(), function(t) {
			sql += "\n" + t.insertPropSQL(opts);
		}, this);
	}

	log.trace({sql: sql}, "Schema.insertPropSQL()");
	return sql;
}

exports.Schema = Schema;

