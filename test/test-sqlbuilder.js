
var assert = require('assert')
	, _ = require('underscore')
	, util = require('util')
	, fs = require('fs');
	
var Table = require('../app/Table.js').Table
	, Schema = require('../app/Schema.js').Schema //to read json
	, TableGraph = require('../app/TableGraph.js').TableGraph
	, SqlBuilder = require('../app/SqlBuilder.js').SqlBuilder;

var log = require('./log.js').log;
	
function sqlReplaceParams(selectResult) {
	var sql = selectResult.query;
	var pos = sql.length - 1;
	for(var i = selectResult.params.length - 1; i >= 0; --i) {
		var param = selectResult.params[i];
		pos = sql.lastIndexOf('?', pos);
		if (_.isString(param)) param = "'" + param + "'";
		sql = sql.substr(0, pos) + param + sql.substr(pos+1);
	}
	return sql;
}

var jsonDir = "test/data/json";

describe('Sandwiches DB', function() {

	var jsonFile = jsonDir + "/sales.json";
	var sqlBuilder;
	var schema;

	beforeEach(function(done) {		
		schema = new Schema();
		schema.jsonRead(jsonFile, function(err) {
			log.info(err);
			assert(err == null, err);
			sqlBuilder = schema.sqlBuilder;
			done();
		});
/*
		var tables = _.map(tableDefs, function(def) {
			return new Table(def);
		});
		var tableGraph = new TableGraph(tables);
		sqlBuilder = new SqlBuilder(tableGraph);
*/
	});	


	it('SqlBuilder.joinGraphSQL', function() {
		
		_.each([
			  ['products', 'orders']
			, ['customers', 'products']
			, ['customers', 'products_in_orders']
			, _.pluck(sqlBuilder.graph.tables(), 'name')
		], function(tables) {
			log.info({tables: tables});

			var sql = sqlBuilder.joinGraphSQL(tables[0], tables);
			log.info({sql: sql});

		});
	});

	it('SqlBuilder.filterSQL', function() {
		var filterClauses = [
			{
				field: 'name',
				table: 'customers',
				op: 'eq',
				value: 'Daniel'
			},
			{
				field: 'total_amount',
				table: 'orders',
				op: 'btwn',
				value: [40.00, 80.00]
			},
			{
				field: '*',
				table: 'products',
				op: 'search',
				value: 'car'
			},
			
		];
		
		var result = sqlBuilder.filterSQL(filterClauses);
		log.info(result.query);
	});

	it('SqlBuilder.selectSQL', function() {
		var filterClauses = [
			{
				field: 'name',
				table: 'customers',
				op: 'eq',
				value: 'Daniel'
			},
			{
				field: 'total_amount',
				table: 'orders',
				op: 'btwn',
				value: [40.00, 80.00]
			},
			/*
			{
				field: '',
				table: 'products',
				op: 'search',
				value: 'car'
			},
			*/
		];
		
		var table = sqlBuilder.graph.table('orders');
		var fields = '*';
		//var fields = ['ref', 'customers_ref', 'total_amount'];
		var orderClauses = [];
		var limit = 10;
		var offset = 50;
		var result = sqlBuilder.selectSQL(table, fields, filterClauses,
					orderClauses, limit, offset);

		//log.info(result.query);
		log.info(sqlReplaceParams(result));
	});

	it('SqlBuilder.createViewSQL', function() {
		//var table = sqlBuilder.graph.table('products_in_orders');
		var table = sqlBuilder.graph.table('orders');
		var result = sqlBuilder.createRowAliasViewSQL(table);
		log.info(result);
	});

	it('SqlBuilder.createSQL', function() {
		//var table = sqlBuilder.graph.table('products_in_orders');
		var result = sqlBuilder.createSQL(schema);
		fs.writeFile('create.sql', result);
		log.info(result);
	});
});


describe('Soccer DB', function() {

	var jsonFile = jsonDir + "/soccer.json";
	var sqlBuilder;

	beforeEach(function(done) {		
		var schema = new Schema();
		schema.jsonRead(jsonFile, function(err) {
			log.info(err);
			assert(err == null, err);
			sqlBuilder = schema.sqlBuilder;
			done();
		});
	});	


	it('SqlBuilder.selectSQL', function() {
		var filterClauses = [
			{
				field: '*',  //full row search
				//field: 'Team',  //full row search
				table: 'Team',
				op: 'search',
				value: 'Madrid'
			},
			{
				field: 'Code',
				table: 'Position',
				op: 'eq',
				value: 'GC' 
			},
		];
		
		var table = sqlBuilder.graph.table('Player');
		var fields = ['Name'];
		//var fields = ['ref', 'customers_ref', 'total_amount'];
		var orderClauses = [];
		var limit = 10;
		var offset = 50;
		var result = sqlBuilder.selectSQL(table, fields, filterClauses,
					orderClauses, limit, offset);

		//log.info(result.query);
		log.info(sqlReplaceParams(result));
	});

	it('SqlBuilder.createViewSQL', function() {
		var table = sqlBuilder.graph.table('Team');
		var result = sqlBuilder.createRowAliasViewSQL(table);
		log.info(result);
	});
});

