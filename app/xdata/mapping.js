var xpath = require('xpath');

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
			  , "Coordinates_GPS" : "Coordenadas_GPS" 
			}
		  }
	  , "MetaPerforacion"
		: { "MetaBorehole"
		  : {   "Coord_collar" : "Coord_collar"
			  , "Datum" : "Datum" 
			  , "Azimuth" : "Azimut" 
			  , "Inclination" : "Inclinacion" 
			  , "Drilling_Company" : "Contratista_Empresa" 
			  , "Name_of_Driller" : "Perforista_Operador" 
			  , "Drilling_Rig" : "Maquina_Perforadora" 
			  , "Date_Drilling_Began" : "Fecha_Inicio_Perforacion" 
			  , "Date_Drilling_Finished" : "Fecha_Fin_Perforacion" 
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

module.exports = mapping;
