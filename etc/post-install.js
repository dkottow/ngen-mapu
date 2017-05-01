var fs = require('fs-extra');
var path = require('path');

var src = process.env.DONKEYLIFT_SWAGGER_FILE;
if (src) {
	var dst = path.join(path.dirname(src), 'swagger.json');
	fs.copySync(src, dst);
} else {
	console.log('env var DONKEYLIFT_SWAGGER_FILE not defined. skipping generation of /public/swagger.json'); 
}
