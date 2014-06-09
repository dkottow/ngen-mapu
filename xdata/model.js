
//stuff to handle xml files
var xpath = require('xpath')
  , dom = require('xmldom')
  , fs = require('fs')
  , path = require('path')
  , _ = require('underscore')
  , util = require('util')
  , mapping = require('./mapping')	
	;

if (global.log) {
	var log = global.log.child({'mod': 'g6.xdata.js'});
} else {
	//e.g when testing 
	var log = require('bunyan').createLogger({
				'name': 'g6.xdata.js', 'level': 'debug'
		});
}

function XDocument(docFile)
{

	var FIELD_USER		= "user";
	var FIELD_DATE		= "date";
	var FIELD_FROM		= "from";
	var FIELD_TO		= "to";

	this.doc = null;
	var statusFile = docFile + ".txt";

	this.post = function(db, cbDone) {
		fs.writeFileSync(statusFile, "Posting to " + db.dbFile)
		//console.log(docFile + " - " + db.dbFile);
		var map = mapping.get(this.doc, db.dbFile);

		//console.log(map);

		_.each(xpath.select("//xData/entityList/entity", this.doc)
			, function(entity) {

			var metaRows = [ readMetaTopics(entity, db, map) ];
			var singleRows = readSingleTopics(entity, db, map);

			var allRows = metaRows.concat(singleRows);
			//console.log(util.inspect(allRows, { depth : 4}));

			var doTables = function(tables) {
				//console.log("doTables " + tables);

				var nextTables = _.filter(db.tableMap(), function(t) {
					return _.some(tables, function(pt) {
						return (t.parent && t.parent.name == pt.name)
							|| (t.supertype && t.supertype.name == pt.name);
					});
				});
				//console.log("nextTables " + nextTables);
				insertRows(db, allRows, nextTables, doTables, cbDone);

				return nextTables;
			}

			var rootTables = _.filter(db.tableMap(), function(t) {
				return t.parent == null && t.supertype == null;
			});

			insertRows(db, allRows, rootTables, doTables, cbDone);

		}); //each entity

	}


	function insertRows(db, srcRows, dstTables, cbNext, cbDone) {
		//console.log("insertRows " + dstTables.length);

		var cbAfterTables = _.after(dstTables.length, cbNext);	

		_.each(dstTables, function(table) {
			console.log("collecting rows of " + table.name);
			var rowGroups = _.filter(srcRows, function(r) {
				return _.contains(_.keys(r), table.name);
			});
			//console.log("rowGroups " + util.inspect(rowGroups, { depth : 3 }));
			if (table.parent) {
				var parentRow = _.find(srcRows[0], function(r, t) {
					return t == table.parent.name;
				});
				var tableRows = _.map(rowGroups, function(rg) {
					return rg[table.name];
				});
				//console.log("adding parent to " + table.name);
				_.each(tableRows, function(r) {
					r[table.parent.name + "_pid"] = parentRow['id'];
					//console.log(r);
				});
			}

			var tableRows = _.map(rowGroups, function(rg) {

				return rg[table.name];
			});
			
			//log into .post logfile
			fs.appendFileSync(statusFile, "\nInserting into " + table.name + ". "); 
			fs.appendFileSync(statusFile, tableRows.length + " rows.");

			db.insert(table, tableRows, function(err, ids) {

				if ( ! err) {
					//assign ids
					var subRowGroups = _.map(rowGroups, function(rg) {
						var subRows = _.filter(rg, function(r) {					
							return _.has(r, table.name + "_sid");
						});
						return subRows;
					});
					_.each(_.zip(subRowGroups, ids), function(rg) {
						_.each(rg[0], function(row) {
							if (_.has(row, table.name + "_sid")) {
								row[table.name + "_sid"] = rg[1];
							} 
						});
					});
					
					var nextTables = cbAfterTables(dstTables);
					//console.log("nextTables " + nextTables);
					if (nextTables && nextTables.length == 0) {
						//nextTables is undefined when dstTables.length > 1
						fs.appendFileSync(statusFile, "\n200 OK");
						cbDone();
					}

					//console.log(subRowGroups);
				} else {
					fs.appendFileSync(statusFile, "\n400 " + err.message);
					cbDone(err);	
				}
				
			});

		});
	}

	function convert(value, field) {
		if (value == null) return value;
		if (field.type == "INTEGER") {
			return parseInt(value);
		} else if (field.type.indexOf("NUMERIC") == 0 
				|| field.type == "FLOAT") {
			return parseFloat(value);
		} else if (field.type == "DATETIME") {
			return value;
			//return Date.parse(value); ??
		}
		return value;
	}

	function readMetaTopics(entity, db, mapping) {
		var metaRows = {};
		var et = entity.getAttribute("type");
		_.each(xpath.select("topic[@register='meta']", entity)
			, function(topic) {

			var tt = topic.getAttribute("table");

			if (mapping[et][tt]) {

				var support = xpath.select("support", topic)[0];

				_.each(mapping[et][tt], function(fields, tableName) {

					var tableDef = db.tableMap()[tableName];

					var row = {};

					row[FIELD_USER] = xpath.select("userName/text()"
										, support).toString();
					row[FIELD_DATE] = xpath.select("logDate/text()"
										, support).toString();

					_.map(fields, function(xField, tField) {

						var xText = xpath.select("register/field[@name='"
										+ xField + "']/text()"
										, support).toString();

						row[tField] = convert(xText, tableDef.fields[tField]);

						if (tableDef.supertype) {
							row[tableDef.supertype.name + "_sid"] = 0;
						}

					});

					metaRows[tableName] = row;
				});
			}
		});
		console.log(util.inspect(metaRows, { depth : 3}));
		return metaRows;
	}

	function readSingleTopics(entity, db, mapping) {
		var singleRows = [];
		var et = entity.getAttribute("type");
		_.each(xpath.select("topic[@register='single']", entity)
			, function(topic) {
			
			var tt = topic.getAttribute("table");
			var fieldNodeMap = null;

			if (mapping[et][tt]) {

				_.each(xpath.select("support", topic), function(srcSupport) {

					var stype = srcSupport.getAttribute("type");
					if (stype == "interval") {
						var pos = xpath.select("position/text()"
									, srcSupport)
									.toString().split("|");
						console.log(pos);
					}
					
					var reg = xpath.select("register", srcSupport)[0];

					if ( ! fieldNodeMap) {
						//build a field node map from first xml register
						fieldNodeMap = {};
						for(var i=0;i < reg.childNodes.length; ++i) {
							var node = reg.childNodes[i];
							if (node.nodeType == 1) {
								fieldNodeMap[node.getAttribute("name")] = i;
							}
						}
						//console.log(fieldNodeMap);
					}


					var rowGroup = {};
					_.each(mapping[et][tt], function(mapFields, tableName) {

						var tableDef = db.tableMap()[tableName];

						var writeRow = true;
						if (_.has(mapFields, "FUNC_FILTER")) {
							writeRow = mapFields["FUNC_FILTER"](reg);
						}
						if (writeRow) {
							var row = {};

							row[FIELD_USER] 
								= xpath.select("userName/text()"
									, srcSupport).toString();
							row[FIELD_DATE] 
								= xpath.select("logDate/text()"
									, srcSupport).toString();

							if (_.has(mapFields, FIELD_FROM)) {
								row[FIELD_FROM] = convert(pos[0]
												, tableDef.fields[FIELD_FROM]); 
							}
							if (_.has(mapFields, FIELD_TO)) {
								row[FIELD_TO] = parseFloat(pos[1]
												, tableDef.fields[FIELD_TO]); 
							}

							_.map(mapFields, function(xField, tField) {
								if (_.isString(xField)) {
/*
									row[tField] 
										= xpath.select("register/field[@name='"
											+ xField + "']/text()", srcSupport)
											.toString();
*/

									//field node map provides instant access
									var node = reg.childNodes[fieldNodeMap[xField]];
									if (node && node.firstChild) {
										var xValue = node.firstChild.nodeValue;
										row[tField] = convert(xValue, tableDef.fields[tField]);
									} else {
										row[tField] = null;
									}
								}
							});

							if (tableDef.parent) {
								row[tableDef.parent.name + "_pid"] = 0;
							}
							if (tableDef.supertype) {
								row[tableDef.supertype.name + "_sid"] = 0;
							}
							//console.log(row);
							rowGroup[tableName] = row;
						}
					});
					singleRows.push(rowGroup);
				});
			}
			
		});

		//console.log(util.inspect(singleRows, { depth : 3}));
		return singleRows;	
	}

	var me = this;
	function parse(file) {
		var xml = fs.readFileSync(file, {"encoding": "utf-8"});
		//console.log(xml);
		me.doc = new dom.DOMParser().parseFromString(xml);		
	}

	parse(docFile);
}

exports.XDocument = XDocument;
