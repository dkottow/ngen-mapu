
var log =  require('../app/log');
var wlog = log.winston.loggers.get('dl');

//wlog.remove(wlog.transports.console);

exports.log = log.log;
