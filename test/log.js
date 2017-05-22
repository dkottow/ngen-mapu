
var log =  require('../app/log').log;
var wlog = require('../app/log').winston.loggers.get('dl');

wlog.remove(wlog.transports.console);


module.exports = { 
    log: log,
};
