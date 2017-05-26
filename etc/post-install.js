var fs = require('fs');
var path = require('path');

var src = process.env.DONKEYLIFT_SWAGGER_FILE;
if (src) {
	var dst = path.join(path.dirname(src), 'swagger.json');
	fs.createReadStream(src).pipe(fs.createWriteStream(dst));
} else {
	console.log('env var DONKEYLIFT_SWAGGER_FILE not defined. skipping generation of /public/swagger.json'); 
}
