

global.log = require('bunyan').createLogger({
	name: 'g6.server',
	level: 'debug',
	src: true,

/*
	streams: [{
		'path': 'log.txt',
	}]
*/
});

var app = require('./app.js').app;

var log = global.log.child({'mod': 'g6.server.js'});

var config = {
	//'ip'	:  '127.0.0.1',
	'ip'	:  '192.168.1.34',
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

