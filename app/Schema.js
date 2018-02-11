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
var config = require('config');

var TableGraph = require('./TableGraph.js').TableGraph;
var SqlHelper = require('./SqlHelperFactory.js').SqlHelperFactory.create();
var Table = require('./Table.js').Table;
var Field = require('./Field.js').Field;
var SchemaDefs = require('./SchemaDefs.js').SchemaDefs;

var log = require('./log.js').log;

var Schema = function() {
	this.init();
}

Schema.prototype.init = function(schemaData) {
	try {
		log.trace('Schema.init()...');
		log.trace({data: schemaData});
		
		schemaData = schemaData || SchemaDefs.EMPTY;
		var tables = _.values(schemaData.tables) || [];	

		var tableNames = _.pluck(tables, 'name');
		var missTables = _.filter(SchemaDefs.MANDATORY_TABLES, function(mt) {
			return ! _.contains(tableNames, mt.name);
		});

		tables = tables.concat(missTables);

		tables = _.map(tables, function(tableDef) {
			return new Table(tableDef);
		});

		var options = _.pick(schemaData, 'join_trees');
		this.graph = new TableGraph(tables, options);
		this.name = schemaData.name;

		_.each(Schema.SYSTEM_PROPERTIES, function(p) {
			if (schemaData.hasOwnProperty(p)) {
				this[p] = schemaData[p];	
			} else {
				this[p] = Schema.SYSTEM_PROPERTY_DEFAULTS[p];
			}
		}, this);

		this.views = schemaData.views || [];

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

		_.each(_.without(Schema.SYSTEM_PROPERTIES, 'join_trees'), function(p) {
			result[p] = this[p];				
		}, this);

		result.views = this.views;

		return result;
		
	} catch(err) {
		log.error({err: err}, "Schema.get() exception.");
		throw err;
	}
}


/******* table ops *******/
Schema.prototype.isEmpty = function() {
	return this.name.length == 0;
}

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


/******* file ops *******/


Schema.prototype.jsonWrite = function(fileName, cbAfter) {
	var me = this;
	try {
		var data = this.get(); //_.pick(this.get(), _.keys(SchemaDefs.EMPTY));
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

Schema.prototype.systemPropertyRows = function() {
	var rows = [];
	_.each(Schema.SYSTEM_PROPERTIES, function(name) {
		var propVal = JSON.stringify(this[name]);
		var defVal = JSON.stringify(Schema.SYSTEM_PROPERTY_DEFAULTS[name]);
		if (propVal != defVal) {
			var row = {};	
			row[SchemaDefs.PROPERTIES_FIELDS.name] = name;
			row[SchemaDefs.PROPERTIES_FIELDS.value] = propVal;
			rows.push(row);
		}

	}, this);

	_.each(this.tables, function(table) {
		rows = rows.concat(table.systemPropertyRows());
	});
	
	return rows;
}

Schema.prototype.systemRows = function() {
	var propertyRows = this.systemPropertyRows(); //includes table and field props

	var result = SchemaDefs.SYSTEM_ROWS;
	result[SchemaDefs.PROPERTIES_TABLE] = propertyRows;
	
	return result;
}


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


Schema.SYSTEM_PROPERTIES = ['join_trees', 'version'];
Schema.SYSTEM_PROPERTY_DEFAULTS = {
	join_trees: [],
};

Schema.systemPropertySelectSQL = function() {
	var fields = _.map(_.values(SchemaDefs.PROPERTIES_FIELDS), function(f) {
		return SqlHelper.EncloseSQL(f);
	});
	var props = Schema.SYSTEM_PROPERTIES.concat(
		Table.SYSTEM_PROPERTIES, 
		Field.SYSTEM_PROPERTIES
	);
	props = _.unique(props);
	props = _.map(props, function(p) {
		return util.format("'%s'", p);
	}).join(', ');
	sql = util.format("SELECT %s FROM %s WHERE name IN (%s)", 
		fields.join(', '),
		SchemaDefs.PROPERTIES_TABLE,
		props
	);

	log.debug({sql: sql}, 'Database.systemPropertySelectSQL')
	return sql;	
}

Schema.setSystemProperties = function(schemaData, rows) {
	_.each(rows, function(r) {
		try {
			var name = r[SchemaDefs.PROPERTIES_FIELDS.name];
			var value = JSON.parse(r[SchemaDefs.PROPERTIES_FIELDS.value]);

			if (r[SchemaDefs.PROPERTIES_FIELDS.table] === null) {
				schemaData[name] = value;

			} else if (r[SchemaDefs.PROPERTIES_FIELDS.field] === null) {
				var table = schemaData
					.tables[r[SchemaDefs.PROPERTIES_FIELDS.table]];
				table[name] = value;

			} else {
				var field = schemaData
					.tables[r[SchemaDefs.PROPERTIES_FIELDS.table]]
					.fields[r[SchemaDefs.PROPERTIES_FIELDS.field]];
				field[name] = value;
			}
		} catch (err) {
			log.error({err: err, property: name, value: r[SchemaDefs.PROPERTIES_FIELDS.value]}, 'Schema.setSystemProperties().');
		}	
	});

}


exports.Schema = Schema;

