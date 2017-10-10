
var config = require('config');

var SchemaDefs = {};

SchemaDefs.EMPTY = {
	name: '',
	tables: [],
	version: config.version
}

SchemaDefs.MANDATORY_TABLES = [
	{
		"name": "_d365AccessScope",
		"row_alias": [ "Name" ],
		"fields": [
			{
				"name": "Name",
				"type": "text(256)"
			}
		]
	},
	{
		"name": "_d365Principals",
		"row_alias": [ "Name" ],
		"fields": [
			{
				"name": "Name",
				"type": "text(256)"
			},
			{
				"name": "Read_id",
				"type": "integer",
				"fk_table": "_d365AccessScope"
			},
			{
				"name": "Write_id",
				"type": "integer",
				"fk_table": "_d365AccessScope"
			}
		
		]
	},
	{
		"name": "_d365TableAccess",
		"row_alias": [],
		"fields": [
			{
				"name": "TableName",
				"type": "text(256)"
			},
			{
				"name": "Principal_id",
				"type": "integer",
				"fk_table": "_d365Principals"
			},
			{
				"name": "Read_id",
				"type": "integer",
				"fk_table": "_d365AccessScope"
			},
			{
				"name": "Write_id",
				"type": "integer",
				"fk_table": "_d365AccessScope"
			}
		
		]
	},
	{
		"name": "_d365UserPrincipal",
		"row_alias": [],
		"fields": [
			{
				"name": "Principal_id",
				"type": "integer",
				"fk_table": "_d365Principals"
			},
			{
				"name": "UserPrincipalName",
				"type": "text(256)"
			}
		]
	},
	{
		"name": "_d365Properties",			
		"row_alias": ["TableName", "FieldName", "Name"],
		"fields": [
			{
				"name": "Name",
				"type": "text(256)"
			},
			{
				"name": "Value",
				"type": "text(MAX)"
			},
			{
				"name": "FieldName",
				"type": "text(256)"
			},
			{
				"name": "TableName",
				"type": "text(256)"
			}
		]
	}
];

var keys = {
    TABLE_ACCESS: {
        NONE: 0,
        ALL: 1,
        OWN: 2
    },
    PRINCIPALS: {
        EVERYONE: 1,
        VIEWER: 2,
        EDITOR: 3
    }
};

//system rows is an array to allow for dependencies between table rows.
SchemaDefs.SYSTEM_ROWS = [
	{
		table: "_d365AccessScope",
		rows: [
			{ "id": keys.TABLE_ACCESS.NONE, "Name": "none" },
			{ "id": keys.TABLE_ACCESS.ALL, "Name": "all" },
			{ "id": keys.TABLE_ACCESS.OWN, "Name": "own" }
		],
	},
	{
		table: "_d365Principals",
		rows: [
            { "id": keys.PRINCIPALS.EVERYONE, 
                "Name": "Everyone", 
                "Read_id": keys.TABLE_ACCESS.NONE, 
                "Write_id": keys.TABLE_ACCESS.NONE 
            }, // access = none
            { "id": keys.PRINCIPALS.VIEWER, 
                "Name": "Viewer", 
                "Read_id": keys.TABLE_ACCESS.ALL, 
                "Write_id": keys.TABLE_ACCESS.NONE 
            }, // read all, write none
            { "id": keys.PRINCIPALS.EDITOR, 
                "Name": "Editor", 
                "Read_id": keys.TABLE_ACCESS.ALL, 
                "Write_id": keys.TABLE_ACCESS.ALL 
            } //read and write all
		]
	},
	{
		table: "_d365TableAccess",
		rows: [
            //everyone gets read-only access to the system tables
            { "TableName": "_d365AccessScope", 
                "Principal_id": keys.PRINCIPALS.EVERYONE, 
                "Read_id": keys.TABLE_ACCESS.ALL, 
                "Write_id": keys.TABLE_ACCESS.NONE 
            }, 
            { "TableName": "_d365Principals", 
                "Principal_id": keys.PRINCIPALS.EVERYONE, 
                "Read_id": keys.TABLE_ACCESS.ALL, 
                "Write_id": keys.TABLE_ACCESS.NONE 
            }, 
            { "TableName": "_d365Properties", 
                "Principal_id": keys.PRINCIPALS.EVERYONE, 
                "Read_id": keys.TABLE_ACCESS.ALL, 
                "Write_id": keys.TABLE_ACCESS.NONE 
            }, 
            { "TableName": "_d365TableAccess", 
                "Principal_id": keys.PRINCIPALS.EVERYONE, 
                "Read_id": keys.TABLE_ACCESS.ALL, 
                "Write_id": keys.TABLE_ACCESS.NONE 
            }, 
            { "TableName": "_d365UserPrincipal", 
                "Principal_id": keys.PRINCIPALS.EVERYONE, 
                "Read_id": keys.TABLE_ACCESS.ALL, 
                "Write_id": keys.TABLE_ACCESS.NONE 
            }, 

            //editors get write access to Principals, UserPrincipal and Properties
            { "TableName": "_d365Principals", 
				"Principal_id": keys.PRINCIPALS.EDITOR, 
				"Read_id": keys.TABLE_ACCESS.ALL, 
				"Write_id": keys.TABLE_ACCESS.OWN 
			}, 
			{ "TableName": "_d365UserPrincipal", 
                "Principal_id": keys.PRINCIPALS.EDITOR, 
                "Read_id": keys.TABLE_ACCESS.ALL, 
                "Write_id": keys.TABLE_ACCESS.OWN
            },
            { "TableName": "_d365Properties", 
				"Principal_id": keys.PRINCIPALS.EDITOR, 
				"Read_id": keys.TABLE_ACCESS.ALL, 
				"Write_id": keys.TABLE_ACCESS.OWN 
			}			
		]
	}
];

SchemaDefs.PROPERTIES_TABLE = "_d365Properties";
SchemaDefs.PROPERTIES_FIELDS = {
	name : 'Name',
	table : 'TableName',
	field : 'FieldName',
	value : 'Value'
};

exports.SchemaDefs = SchemaDefs;
