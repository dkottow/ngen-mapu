
exports.startHRTime = function(hrtime) {
    hrtime = hrtime || {};
    hrtime.start = process.hrtime();
    return hrtime;
};

exports.stopHRTime = function(hrtime) {
    if ( ! hrtime || ! hrtime.start) return hrtime;
    hrtime.stop = process.hrtime(hrtime.start);
    hrtime.secs = (hrtime.stop[0] * 1e9 + hrtime.stop[1]) / 1e9;
    return hrtime;
};

// sleep time expects milliseconds
exports.sleep = function(time) {
  return new Promise((resolve) => setTimeout(resolve, time));
};

exports.memInfo = function() {
 return process.memoryUsage();    
}

