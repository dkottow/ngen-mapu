
//stuff to handle xml files
var xpath = require('xpath')
  , dom = require('xmldom').DOMParser
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
			  , "Descripcion_geologica"  
				: { "Material"
				  : {   
						"from" : null
					  ,	"to" : null	
					  ,	"type" : "Tipo_material"
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
					  , "Other_Name" : ""
					  , "Secondary_Name" : ""
					  , "Other_secondary_name" : ""
					  , "Formation_Name" : ""
					  , "Formation_Age" : ""
					  , "Geologic_Period" : ""
					  , "Texture" : "Textura"
					  , "Other_texture" : ""
					  , "Notes_texture" : ""
					  , "Angularity" : ""
					  , "Notes_angularity" : ""
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
					  , "Reaction_HCL_rock" : ""
					  , "Minerals" : ""
					  , "Other_minerals" : ""
					  , "Percent_Quartz" : ""
					  , "Acid_rock" : ""
					  , "Percent_Biotite" : ""
					  , "Percent_Hornblende" : ""
					  , "Percent_Plagioclase" : ""
					  , "Percent_Feldespar_alkaline" : ""
					  , "Percent_Spar" : ""
					  , "Percent_Mica" : ""
					  , "Percent_Moscovite" : ""
					  , "Percent_Pyroxenes" : ""
					  , "Percent_Olivine" : ""
					  , "Percent_Mafics" : ""
					  , "Minerals_Mafics" : ""
					  , "Feldspar" : ""
					  , "Other_feldspar" : ""
					  , "Type_Mica" : ""
					  , "Others_micas" : ""
					  , "Type_pyroxenes" : ""
					  , "Other_pyroxenes" : ""
					  , "Notes_minerals" : ""
					  , "Minerals_accessory" : ""
					  , "Others_accessory" : ""
					  , "Notes_accessory" : ""
					  , "Type_frag" : ""
					  , "Other_frag" : ""
					  , "Notes_frag" : ""
					  , "Minerals_dark" : ""
					  , "Particle_size" : ""
					  , "Other_particles" : ""
					  , "Texture_Pyroclastics" : ""
					  , "Notes_pyro_texture" : ""
					  , "Depositional_Setting" : ""
					  , "Others_deposits" : ""
					  , "Continental" : ""
					  , "Other_continental" : ""
					  , "Transitional" : ""
					  , "Marine" : ""
					  , "Other_marine" : ""
					  , "Fracturing" : ""
					  , "Other_fract" : ""
					  , "Porosity" : ""
					  , "Notes_porosity" : ""
					  , "Notes_rocks" : ""
									
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
		me.doc = new dom().parseFromString(xml);		
	}

	parse(docFile);

	function readMetaTopics(entity, mapping) {
		var metaRows = {};
		var et = entity.getAttribute("type");
		_.each(xpath.select("topic[@register='meta']", entity)
			, function(topic) {

			var tt = topic.getAttribute("table");
			if (mapping[et][tt]) {

				var support = xpath.select("support", topic)[0];

				_.each(mapping[et][tt], function(fields, table) {
					var row = {};

					row[FIELD_USER] = xpath.select("userName/text()"
										, support).toString();
					row[FIELD_DATE] = xpath.select("logDate/text()"
										, support).toString();

					_.map(fields, function(xField, tField) {
						row[tField] = xpath.select("register/field[@name='"
										+ xField + "']/text()"
										, support).toString();
					});

					metaRows[table] = row;
				});
			}
		});
		console.log(util.inspect(metaRows, { depth : 3}));
		return metaRows;
	}

	function readSingleTopics(entity, mapping) {
		var singleRows = [];
		var et = entity.getAttribute("type");
		_.each(xpath.select("topic[@register='single']", entity)
			, function(topic) {
			
			var tt = topic.getAttribute("table");
			if (mapping[et][tt]) {

				_.each(xpath.select("support", topic), function(support) {

					var stype = support.getAttribute("type");
					if (stype == "interval") {
						var pos = xpath.select("position/text()"
									, support)
									.toString().split("|");
						console.log(pos);
					}

					var rowGroup = {};
					_.each(mapping[et][tt], function(fields, table) {
						var reg = xpath.select("register", support)[0];

						var writeRow = true;
						if (_.has(fields, "FUNC_FILTER")) {
							writeRow = fields["FUNC_FILTER"](reg);
						}
						if (writeRow) {
							var row = {};

							row[FIELD_USER] 
								= xpath.select("userName/text()"
									, support).toString();
							row[FIELD_DATE] 
								= xpath.select("logDate/text()"
									, support).toString();

							if (_.has(fields, FIELD_FROM)) {
								row[FIELD_FROM] = pos[0]; 
							}
							if (_.has(fields, FIELD_TO)) {
								row[FIELD_TO] = pos[1]; 
							}

							//TODO expensive...
							_.map(fields, function(xField, tField) {
								if (_.isString(xField)) {
									row[tField] 
										= xpath.select("register/field[@name='"
											+ xField + "']/text()", support)
											.toString();
								}
							});
							//console.log(row);
							rowGroup[table] = row;
						}
					});
					singleRows.push(rowGroup);
				});
			}
			
		});

		console.log(util.inspect(singleRows, { depth : 3}));
		return singleRows;	
	}


	this.post = function(db) {
		//console.log(template + " - " + db.dbFile);
		var mapping = mapTemplate(this.doc, db.dbFile);

		//console.log(mapping);

		_.each(xpath.select("//xData/entityList/entity", this.doc)
			, function(entity) {

			var rows = {"meta" : {}, "single" : [] };

			rows["meta"] = readMetaTopics(entity, mapping);
			rows["single"] = readSingleTopics(entity, mapping);



		}); //each entity

	}

}

exports.XDocument = XDocument;
