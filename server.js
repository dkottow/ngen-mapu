
global.log = require('bunyan').createLogger({
	name: 'g6.server',
	src: true,
	streams: [
	{
		stream: process.stdout,
		level: 'info'
	}, 
	{
		type: 'rotating-file',
		path: 'logs/g6.rest-server.json',
		level: 'trace',
		period: '1d'
	}]
});

var app = require('./app/app.js').app;

var log = global.log.child({'mod': 'g6.server.js'});

var config = {
	'ip'	:  'localhost',
	//'ip'	:  '192.168.1.38',
	'port'	: 3000, 
}

if (process.env.OPENSHIFT_DATA_DIR) {
	config.ip = process.env.OPENSHIFT_NODEJS_IP;
	config.port = process.env.OPENSHIFT_NODEJS_PORT;

} else if (process.env.C9_USER) {
	config.ip = process.env.IP;
	config.port = process.env.PORT;
}

app.listen(config.port, config.ip, function() {
	log.info("Started server on " + config.ip + ":" + config.port);
	console.log("Started server on " + config.ip + ":" + config.port);
});

