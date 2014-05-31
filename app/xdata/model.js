
//stuff to handle xml files
var xpath = require('xpath')
  , dom = require('xmldom')
  , fs = require('fs')
  , path = require('path')
  , _ = require('underscore')
  , util = require('util')
	;


if (global.log) {
	var log = global.log.child({'mod': 'g6.xdata.js'});
} else {
	//e.g when testing 
	var log = require('bunyan').createLogger({
				'name': 'g6.xdata.js', 'level': 'info'
		});
}

var FIELD_USER		= "user";
var FIELD_DATE		= "date";
var FIELD_FROM		= "from";
var FIELD_TO		= "to";

function mapTemplate(xDoc, dbFile)
{
	var template = xpath.select("//xData", xDoc)[0].getAttribute("template");
	var dbKey = path.basename(dbFile).split(".")[0];
	var mapKey = template + " > " + dbKey;

	var mapping = {
			/* 	{ XEntityType : 
			   		{ XTopicTable : 
			   		  { DBTable : 
						{ XField : field }
				}}} */
		"LIMA_PPC_N > gaslink" 
		: { "Perforacion"
			: { "MetaUbicacion" 
				: { "MetaLocation"
				  : {   "Project_Number" : "Numero_Proyecto"
					  , "Project_Name" : "Nombre_Proyecto" 
					  , "Client" : "Cliente" 
					  , "Person_logging" : "Responsable_logueado" 
				    }
			  	  }
			  , "MetaPerforacion"
				: { "MetaBorehole"
				  : {   "Coord_collar" : "Coord_collar"
					  , "Datum" : "Datum" 
					  , "Azimuth" : "Azimut" 
				    }
			  	  }
				  
			  , "Descripcion_geologica"  
				: { "Material"
				  : {   
						"from" : null
					  ,	"to" : null	
					  ,	"Material" : "Tipo_material"
					  , "Bad_interval" : "Tramo_Malo"	
					}					
				  , "Rock" 
				  : {
						"FUNC_FILTER" : function(reg) { 
							return xpath
								.select("field[@name='Tipo_material']/text()"
								, reg) == "Roca"; 
						}
					  ,	"Color_rock" : "Color_roca"
				 	  , "Color_intensity_rock" : "Color_intensidad_roca"
					  , "Rock_moisture" : "Humedad_Roca"
  					  , "Type_rock" : "Tipo_roca"
					  , "Other_rock" : "Otro_roca"
					  , "Rock_Name" : "Nombre_roca"

					  , "Other_Name" : "Otro_Nombre"
					  , "Secondary_Name" : "Nombre_Secondario"
					  , "Other_secondary_name" : "Otro_secondario"
					  , "Formation_Name" : "Nombre_formacion"
					  , "Formation_Age" : "Edad_formacion"
					  , "Geologic_Period" : "Periodo_Geologico"
					  , "Texture" : "Textura"
					  , "Other_texture" : "Otra_textura"
					  , "Notes_texture" : "Notas_textura"
					  , "Angularity" : "Angularidad"
					  , "Notes_angularity" : "Notas_angularidad"
					  , "Shape_clasts" : ""
					  , "Notes_clasts" : ""
					  , "Structures" : ""
					  , "Sed_structure" : ""
					  , "Notes_structure" : ""
					  , "Micro_defects" : ""
					  , "Bedding_Size" : ""
					  , "Bedding_inclination" : ""
					  , "Notes_bedding" : ""
					  , "Notes_stratification" : ""
					  , "Reaction_HCL_rock" : "Reaccion_HCL_roca"
					  , "Minerals" : "Minerales"
					  , "Other_minerals" : "Otros_minerales"
					  , "Percent_Quartz" : "Porc_Cuarzo"
					  , "Acid_rock" : "Acidez_roca"
					  , "Percent_Biotite" : "Porc_Biotita"
					  , "Percent_Hornblende" : "Porc_Hornblenda"
					  , "Percent_Plagioclase" : "Porc_Plagioclasa"
					  , "Percent_Feldespar_alkaline" : "Porc_Feldespato_alcalino"
					  , "Percent_Spar" : "Porc_Spar"
					  , "Percent_Mica" : "Porc_Mica"
					  , "Percent_Moscovite" : "Porc_Moscovita"
					  , "Percent_Pyroxenes" : "Porc_Piroxenos"
					  , "Percent_Olivine" : "Porc_Olivina"
					  , "Percent_Mafics" : "Porc_Maficos"
					  , "Minerals_Mafics" : "Minerales_Maficos"
					  , "Feldspar" : "Feldespatos"
					  , "Other_feldspar" : "Otro_feldespato"
					  , "Type_Mica" : "Tipo_Mica"
					  , "Others_micas" : "Otros_micas"
					  , "Type_pyroxenes" : "Tipo_piroxenos"
					  , "Other_pyroxenes" : "Otro_piroxenos"
					  , "Notes_minerals" : "Notas_minerales"
					  , "Minerals_accessory" : "Minerales_accesorios"
					  , "Others_accessory" : "Otros_accesorios"
					  , "Notes_accessory" : "Notas_accesorios"
					  , "Type_frag" : "Tipo_frag"
					  , "Other_frag" : "Otro_frag"
					  , "Notes_frag" : "Notas_frag"
					  , "Minerals_dark" : "Minerales_oscuros"
					  , "Particle_size" : "Tamano_particula"
					  , "Other_particles" : "Otro_tipo_part"
					  , "Texture_Pyroclastics" : "Textura_Piro"
					  , "Notes_pyro_texture" : "Notas_text_piro"
					  , "Depositional_Setting" : ""
					  , "Others_deposits" : "Otros_depositos"
					  , "Continental" : "Continental"
					  , "Other_continental" : "Otros_continentales"
					  , "Transitional" : "Transicional"
					  , "Marine" : "Marino"
					  , "Other_marine" : "Otro_marino"
					  , "Fracturing" : "Fracturamiento"
					  , "Other_fract" : "Otro_fract"
					  , "Porosity" : "Porosidad"
					  , "Notes_porosity" : "Notas_poro"
					  , "Notes_rocks" : "Notas_rocas"
									
				    }	
				  , "Soil" 
				  : {
						"FUNC_FILTER" : function(reg) { 
							return xpath
								.select("field[@name='Tipo_material']/text()"
								, reg) == "Suelo"; 
						}
					  ,	"Color_soil" : "Color_suelo"
				 	  , "Color_intensity_soil" : "Color_intensidad_suelo"
					  , "Mottling_color" : "Color_abigarramiento"
					  , "Mottling_intensity" : "Abigarramiento_intensidad"
					  ,	"Percent_Organic" : "Porc_Organico"
					  , "Percent_Boulders" : "Porc_Bloques" 
				      ,	"Percent_Cobbles" : "Porc_Cantos" 
					  ,	"Percent_Gravel" : "Porc_Grava"
					  ,	"Percent_Sand" : "Porc_Arena"
					  , "Percent_Fines" : "Porc_Fino"
					  ,	"Grading" : "Gradacion"
					  ,	"Dilatancy" : "Dilatancia"

						
				    }	
				  }	
			  }
		  }
	  };

	return mapping[mapKey];
} 

function XDocument(docFile)
{
	this.doc = null;

	var me = this;
	function parse(file) {
		var xml = fs.readFileSync(file, {"encoding": "utf-8"});
		//console.log(xml);
		me.doc = new dom.DOMParser().parseFromString(xml);		
	}

	parse(docFile);

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
								row[FIELD_FROM] = pos[0]; 
							}
							if (_.has(mapFields, FIELD_TO)) {
								row[FIELD_TO] = pos[1]; 
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

	this.post = function(db, cbDone) {
		//console.log(template + " - " + db.dbFile);
		var mapping = mapTemplate(this.doc, db.dbFile);

		//console.log(mapping);

		_.each(xpath.select("//xData/entityList/entity", this.doc)
			, function(entity) {

			var metaRows = readMetaTopics(entity, db, mapping);

			var rootTables = _.filter(_.keys(metaRows), function(tableName) {
				return _.every(metaRows[tableName], function(v, k) {
					return k.lastIndexOf("_sid") != (k.length - "_sid".length);
				});
			});
			//console.log(rootTables);

			_.each(rootTables, function(t) {
				db.insert(db.tableMap()[t], [metaRows[t]], function(err, ids) {
					
					console.log("Insert " + t + " id " + ids[0]);
					metaRows[t]['id'] = ids[0];

//TODO wer are not done yet...
cbDone(err, ids);
				});
			});
			//console.log(util.inspect(metaRows, { depth : 3}));
/*
			var singleRows = readSingleTopics(entity, db, mapping);
			console.log(util.inspect(singleRows, { depth : 3}));
*/

		}); //each entity

	}

}

exports.XDocument = XDocument;
