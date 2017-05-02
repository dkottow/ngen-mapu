var fs = require('fs-extra');
var path = require('path');

var src = process.env.DONKEYLIFT_SWAGGER_FILE;
var dst = path.join(path.dirname(src), 'swagger.json');
fs.copySync(src, dst);
