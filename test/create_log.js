
var bunyan = require('bunyan');

var log = bunyan.createLogger({
	name: 'g6.mocha',
	level: 'trace',
	serializers: bunyan.stdSerializers,
	src: true,
	streams: [{
		type: 'rotating-file',
		path: 'test/log.json',
		period: '10000ms'
	}]
});

exports.log = log;
