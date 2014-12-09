/*
	mocha tests - run me from parent dir
*/
var assert = require('assert')
	, _ = require('underscore')
	, util = require('util')
	, sqlite3 = require('sqlite3').verbose()
	, Model = require('../app/model').Model;
	
var isDescendant = require('../app/model').isDescendant;


describe('Model', function() {
	var dbFile = "test/test.sqlite";
	var model = new Model(dbFile);

	before(function(done) {
		model.init(done);
	});	

	after(function(done) {
		//console.log("DELETING ALL ROWS id > 2");
		var db = new sqlite3.Database(dbFile);
		db.run("DELETE FROM borehole WHERE id > 1", done);
		db.close();
	});

	describe('init()', function() {
		it('guards file not found', function(done) {
			var m = new Model("file-not-found.sqlite");
			m.init(function(err) {
				assert(err instanceof Error);
				done();	
			});
		});
	});
	
  	describe('getSchema()', function() {		

		var defs;
		before(function(done) {
			defs = model.getSchema(function(err, result) {
				defs = result;
				console.log(defs);
				done();
			});
			//console.log(defs);
		});

		it('test.sqlite has 6 tables', function() {
			assert.equal(_.values(defs).length, 6);
		});

		it('test.sqlite borehole root table', function() {
			var borehole = _.find(defs, function(t) {
				return t.name == 'borehole';
			});
			assert(borehole, 'table exists');
			assert.equal(borehole.parent, null, 'parent is null');
			assert.equal(borehole.support, 'text', 'support is text');
		});

	});

  	describe('isDescendant()', function() {		
		it('descendant from borehole', function() {
			var d = model.tableMap()['fracture'];
			var t = model.tableMap()['borehole'];
			var result = isDescendant(d, t, 5);
console.log("Descendant " + d.name + " from " + t.name + " is " + result);	
		});
	});

  	describe('getDeep()', function() {		
		it('get borehole deep', function(done) {
			model.getDeep(model.tableMap()['borehole']
						  	,{'field' : 'id', 'value' : 1}
						  	,'*', 2
							, function(err, result) {
				console.log("deep rc " + err);

//console.log("******* done deep... *******")
//console.log(util.inspect(result, {depth: 5}));				
//console.log("******* ...done deep *******")

				done();
			});
		});
	});



  	describe('all()', function() {		

		it('all root tables', function(done) {
			var roots = _.filter(model.tables, function(t) {
				return t.parents == null && t.supertype == null;
			});

			var allDone = _.after(roots.length, done);			

			_.each(roots, function(t) {
				var order = {'name': 'asc'};
				model.all(t, {}, '*', order, 1000, function(err, result) {
					assert(err == null);
					console.log('got ' + result.length + " " + t.name);
					assert(result.length > 0, 'got some ' + t.name);
					allDone();
				});
			});

		});
	});


  	describe('insert()', function() {		
		it('100 rows', function(done) {
			this.timeout(10000); //10secs

			var table = model.tableMap()['borehole'];

			var rows = [];
			var row = {'name': 'test', 'user': 'mocha', 'date': '2000-01-01', 'lat': 123.45, 'lon': 67.890, 'desc': 'a unit-test pit' };

			for(var i = 1;i < 100; ++i) {
				var r = _.clone(row);
				if ( i < 10)  r['name'] = 'test00' + i;
				else r['name'] = 'test0' + i;
				rows.push(r);
			}

			model.insert(table, rows, function(err, result) { 
				assert(err == null, err);
				done(); 
			});
		});

		it('fail on 2nd row', function(done) {
			var table = model.tableMap()['borehole'];
			var rows = [{'name': 't2', 'user': 'mocha', 'date': '2000-01-01', 'lat': 123.45, 'lon': 67.890, 'desc': 'a unit-test pit' }, {'name': 't3', 'user': null, 'date': '2000-01-01', 'lat': 123.45, 'lon': 67.890, 'desc': 'a unit-test pit' }];
			model.insert(table, rows, function(err, result) { 
				console.log(err);
				console.log(result);
				assert(err instanceof Error, 'sqlite null constraint holds on 2nd row');
				done();
			});
		});

		it('non-null field missing', function(done) {
			var table = model.tableMap()['borehole'];
			var row = {'name': null, 'user': 'mocha', 'date': '2000-01-01', 'lat': 123.45, 'lon': 67.890, 'desc': 'a unit-test pit' };
			model.insert(table, [row], function(err, result) { 
				console.log(err);
				assert(err instanceof Error, 'sqlite null constraint holds');
				done();
			});
		});

		it('field type mismatch (date)', function(done) {
			var table = model.tableMap()['borehole'];
			var row = {'name': 'test', 'user': 'mocha', 'date': '2000-41-01', 'lat': 123.45, 'lon': 67.890, 'desc': 'a unit-test pit' };
			model.insert(table, [row], function(err, result) { 
				console.log(err);
				assert(err instanceof Error, 'sqlite check constraint holds');
				done();
			});
		});
	});

  	describe('update()', function() {		
		it('some rows', function(done) {
			var table = model.tableMap()['borehole'];

			var rows = [];
			var row = {'id': 1, 'name': 'test', 'user': 'mucha', 'date': '2000-01-01', 'lat': 123.45, 'lon': 67.890, 'desc': 'a unit-test pit' };

			rows.push(row);

			for(var i = 5; i < 20; ++i) {
				var r = _.clone(row);
				r['id'] = i;
				if ( i < 10)  r['name'] = 'upd00' + i;
				else r['name'] = 'upd0' + i;
				rows.push(r);
			}

			model.update(table, rows, function(err, result) { 
				assert(err == null, 'update some rows');
				done(); 
			});
		});

		it('row does not exist', function(done) {
			var table = model.tableMap()['borehole'];

			var row = {'id': 666, 'name': 'test', 'user': 'mucha', 'date': '2000-01-01', 'lat': 123.45, 'lon': 67.890, 'desc': 'a unit-test pit' };

			model.update(table, [row], function(err, result) { 
				console.log(err);
				assert(err instanceof Error, 'row does not exist');
				done(); 
			});
		});

		it('field type mismatch (numeric)', function(done) {
			var table = model.tableMap()['rock'];

			var row = {'id': 1, 'from': 'foo', 'to': 100, 'user': 'mocha', 'date': '2000-01-01', 'borehole_pid': 1 };

			model.update(table, [row], function(err, result) { 
				console.log(err);
				assert(err instanceof Error, 'update did not fail');
				done(); 
			});
		});


		it('unknown foreign key', function(done) {
			var table = model.tableMap()['rock'];

			var row = {'id': 1, 'from': 50, 'to': 100, 'user': 'mocha', 'date': '2000-01-01', 'borehole_pid': 666 };

			model.update(table, [row], function(err, result) { 
				console.log(err);
				assert(err instanceof Error, 'update did not fail');
				done(); 
			});
		});
	});

  	describe('delete()', function() {		
		it('delete some fracture rows', function(done) {
			var table = model.tableMap()['borehole'];

			model.delete(table, [10, 11, 12], function(err, result) {
				console.log(err);
				assert(err == null, 'deleted some rows');
				done(); 
			});
		});
	});

  	describe('all() and get()', function() {		

		it('all root tables', function(done) {
			var roots = _.filter(model.tables, function(t) {
				return t.parent == null;
			});

			var allDone = _.after(roots.length, done);			

			_.each(roots, function(t) {
				model.all(t, {}, '', '*', {}, "", function(err, result) {
					assert(result.length > 0, 'got some ' + t.name);
					allDone();
				});
			});

		});

		it('list rows of first child table belonging to borehole Pit001', function(done) {


			var child = _.find(model.tables, function(t) {
				return _.contains(t.parents, function(pt) {
					pt.name == 'borehole';
				});
			});

			model.get(child.parent, {'field': 'id', 'op': 'lesser', 'value': 100}, '', ['borehole.id', 'borehole."user"'], function(err, result) {
				model.all(child, {'borehole.id': result.id}, '*', {}, "", function(err, result) {
					assert(result.length > 10, 'got more than 10 ' + child.name);
					assert(result[10].from > 20, child.name + ' #10 is deeper than 20 mts');
					done();
				});
			});
		});

		it('list rows of fracture table belonging to borehole 1', function(done) {
			var table = _.find(model.tables, function(t) {
				return t['name'] == 'fracture';
			});
			
			model.all(table, {'borehole.id' : 1}, '*', {'distance': 'asc'}, '5, 100', function(err, result) {
				assert(result.length > 10, 'got more than 10 fractures');
				done();
			});
		});

		it('list rows of fracture table belonging to rock 1', function(done) {
			var table = _.find(model.tables, function(t) {
				return t['name'] == 'fracture';
			});
			
			model.all(table, {'rock.id' : 1}, '*', {}, "", function(err, result) {
				assert(1 <= result.length && result.length < 10, 'got between 1 and 10 fractures');
				done();
			});
		});

		it('list rows of ground_soil table belonging to borehole 2', function(done) {
			var table = _.find(model.tables, function(t) {
				return t['name'] == 'ground_soil';
			});
			
			model.all(table, {'borehole.id' : 2}, '*', {}, 100, function(err, result) {
				assert(result.length > 5, 'got more than 5 soils');
				done();
			});
		});
	});



});

