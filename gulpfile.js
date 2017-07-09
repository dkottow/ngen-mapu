var gulp = require('gulp');
var fs = require('fs');

require('dotenv').config();
var config = require('config');

var allTasks = [ 'build-swagger-file'
];

gulp.task('default', allTasks, function() {
});

gulp.task('build-swagger-file', function(cbAfter) {

    var swagger = require('./etc/swagger.json');
    swagger.host = config.url.host;
    swagger.schemes = [ config.url.protocol ];

    fs.writeFile('./public/swagger.json', JSON.stringify(swagger), function(err) {
        cbAfter();
    });

});
