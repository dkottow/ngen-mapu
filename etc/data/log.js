
var bunyan = require('bunyan');

var log = bunyan.createLogger({
	name: 'create_data',
	level: 'debug',
	serializers: bunyan.stdSerializers,
	src: true,
	streams: [{
		type: 'file',
		path: './log-output.json',
	}]
});


exports.log = log;
