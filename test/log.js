
var log =  require('../app/log').log;
var wlog = require('../app/log').winstonLogger;

//wlog.remove(wlog.transports.console);

module.exports = { 
    log: log,
};
