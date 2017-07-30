
var assert = require('assert')
	, _ = require('underscore')
	, util = require('util')
	, fse = require('fs-extra');

global.config = global.config || {},
global.config.sql_engine = 'sqlite';
	
var APP_PATH = "../app/";

var AccessControl = require(APP_PATH + 'AccessControl').AccessControl
	, Database = require(APP_PATH + 'sqlite/DatabaseSqlite').DatabaseSqlite
	, Table = require(APP_PATH + 'Table.js').Table
	, Schema = require(APP_PATH + 'Schema.js').Schema;
	
var log =  require('./log').log;


describe('AccessControl', function() {
	var accountDir = "test/data/sqlite";

	var users = {
		"admin": {
			name: "admin@donkeylift.com"
			, account: "demo"
			, admin: true
		} 
		, "reader": {
			name: "reader@donkeylift.com"
			, account: "demo"
			, role: "reader"
		}
		, "writer": {
			name: "writer@donkeylift.com"
			, account: "demo"
			, role: "writer"
		}
	};


	describe('AccessControl.authRequest()', function() {
		var access = new AccessControl({ auth: true });
		var db = new Database(accountDir + '/sales.sqlite');	
		var path = {
			account: { name: 'demo' } //mockup
			, db: db
		}

		before(function(done) {
			db.readSchema(function(err) { 
				assert(err == null, 'Error loading ' + db.name());
				done(); 
			});
		});	

		it('user is admin', function(done) {
			access._authRequest('putDatabase', { user: users.admin }, path, function(err, result) {
				assert(err == null, 'Error');
				assert(result.granted, 'User is admin. ' + util.inspect(result.error));
				done();
			});
		});

		it('user account mismatch', function(done) {
			var wrongPath = { account: { name: 'foo' }};
			access._authRequest('putDatabase', { user: users.admin }, wrongPath, function(err, result) {
				assert(err == null, 'Error');
				assert( ! result.granted, 'User is admin. ' + util.inspect(result));
				done();
			});
		});

		it('user is not admin', function(done) {
			access._authRequest('putDatabase', { user: users.reader }, path, function(err, result) {
				assert(err == null, 'Error');
				assert( ! result.granted, 'User is admin. ' + util.inspect(result.error));
				done();
			});
		});
	});
	
	describe('AccessControl.filterQuery()', function() {
		var access = new AccessControl({ auth: true });
		var db = new Database(accountDir + '/sales.sqlite');	
		var path = {
			account: { name: 'demo' } //mockup
			, db: db
		}

		before(function(done) {
			db.readSchema(function(err) { 
				assert(err == null, 'Error loading ' + db.name());
				done(); 
			});
		});	

		it('user is reader, table with default access control', function(done) {
			var query = {
				filter: []
				, fields: '*'
			};
			
			path.table = db.table('customers');
			
			var result = access.filterQuery(path, query, users.reader);
			assert( ! result.error, 'Error ' + util.inspect(result));
			done();
		});

		it('user is reader, customers with read own access control', function(done) {
			var query = {
				filter: []
				, fields: '*'
			};
			
			path.table = db.table('customers');
		
			//hack table access control
			var ac = _.find(path.table.access_control, function(ac) { 
				return ac.role == Schema.USER_ROLES.READER
			});
			ac.read = Table.ROW_SCOPES.OWN;
			
			var result = access.filterQuery(path, query, users.reader);
			assert( result.filter.length == 1, 'Error ' + util.inspect(result));
			done();
		});

		it('user is reader, customers, orders with read own access control', function(done) {
			var query = {
				filter: [
					{ field: 'id', op: 'ge', value: 5 }
				]
				, fields: [
					{ field: 'ref' }
					, { table: 'orders', field: 'ref' }
				]
			};
			
		
			//hack access control on orders
			_.each(db.table('orders').access_control, function(ac) { 
				ac.read = Table.ROW_SCOPES.OWN;
			});
			
			path.table = db.table('customers');

			var result = access.filterQuery(path, query, users.reader);
			assert( ! result.error, 'Error ' + util.inspect(result));

			var ownFilters = _.filter(result.filter, function(f) {
				return f.field == 'own_by';
			});
			assert( ownFilters.length == 2, 'Error ' + util.inspect(result));
			done();
		});
		
	});
});


