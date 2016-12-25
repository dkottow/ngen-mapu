
/*
	mocha tests - run me from parent dir
*/
var assert = require('assert')
	, _ = require('underscore')
	, util = require('util');
	
var parser = require('../app/QueryParser');

var log = require('./log.js').log;

describe('Parser.parser', function() {
	it('skip', function() {		
		var q = '$skip=1';
		var result = parser.parse(q);			
		assert.equal(result.value, 1);
	});
	
	it('orderby', function() {		
		try {
			var q = '$orderby=foo DESC, bar';
			var result = parser.parse(q);			
			log.info(result);
		} catch(e) {
			console.log(e);
		}
		assert.equal(result.value.length, 2);
		assert.equal(result.value[0].order, 'DESC');
		assert.equal(result.value[1].field, 'bar');
		assert.equal(result.value[1].order, 'asc');
	});

	it('filter eq ne', function() {		
		try {
			var q = "$filter=foo eq 'foo'\tbar.bar ne 6";
			var result = parser.parse(q);			
			log.info(result);
		} catch(e) {
			console.log(e);
		}
		assert.equal(result.value.length, 2);
		assert.equal(result.value[1].table, 'bar');
		assert.equal(result.value[1].field, 'bar');
		assert.equal(result.value[1].value, 6);
	});
	it('filter in', function() {	
		var q = "$filter=foo in 4,9,6";	
		var result = parser.parse(q);			
		assert.equal(result.value[0].value.length, 3);
	});
});
	
