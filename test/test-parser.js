
/*
	mocha tests - run me from parent dir
*/
var assert = require('assert')
	, _ = require('underscore')
	, util = require('util');
	
global.log = require('./log.js').log;

var parser = require('../app/QueryParser');

var log = global.log.child({'mod': 'mocha.test-parser.js'});

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
		assert.equal(result.value[1]['bar'], 'asc');
	});

	it('filter eq ne', function() {		
		try {
			var q = "$filter=foo eq 'foo' and bar.bar ne 6";
			var result = parser.parse(q);			
			log.info(result);
		} catch(e) {
			console.log(e);
		}
		assert.equal(result.value.length, 2);
		assert.equal(result.value[1].field, 'bar');
		assert.equal(result.value[1].value, 6);
	});
	it('filter in', function() {	
		var q = "$filter=foo in 4,9,6";	
		var result = parser.parse(q);			
		assert.equal(result.value[0].value.length, 3);
	});
});
	
