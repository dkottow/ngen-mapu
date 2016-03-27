

var log = require('bunyan').createLogger({
	name: 'g6.mocha',
	level: 'debug',
	src: true,
	streams: [{
		type: 'rotating-file',
		path: 'test/log-output.json',
		period: '10000ms'
	}]
});

exports.log = log;