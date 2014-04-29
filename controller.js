var _ = require('underscore')

var log = global.log.child({'mod': 'g6.controller.js'});

function Controller(app, restBase, model)
{	
	this.app = app;
	this.base = restBase;
	this.model = model;

	this.init = function() {
		var me = this;

		//describe database 
		var defsHandler = function(req, res) {
			var defs = me.model.defs();
			_.each(defs, function(t) {
				t['url'] = me.base + "/" + t['name'];
			});
			res.send(defs);
		}
		this.app.get(me.base, defsHandler);
		this.app.get(me.base + ".db", defsHandler);
		
		var rowsExt = ".rows";
		_.each(me.model.tables, function(table) {
			var url = me.base + "/" + table['name'];

			//select all table rows 
			//	can be filtered by some *ancestor* table id 
			//	given in query string. 
			//
			//		e.g. /[base]/fracture?borehole=1 
			//			 will give you all fractures (of all rocks) 
			//			 belonging to borehole.id=1	
			//
			//  while	/[base]/fracture?rock=3
			//			will give you all fractures of rock.id=3

			var getRowsHandler = function(req, res) {
				log.info(req.method + " " + req.url);
				me.model.all({}, req.query, table, '*', function(err, result) { 
					if (err) {
						log.warn(err);
						res.send(400, err.message);
					} else {
						log.debug(result);
						res.send(result); 
					}
				});
			}		//

			me.app.get(url, getRowsHandler);	
			me.app.get(url + rowsExt, getRowsHandler);	

			//insert a row into table
			var postRowHandler = function(req, res) {
				log.info(req.method + " " + req.url);
				log.info({'req.body': req.body});
				var row = req.body;
				me.model.insert(table, [row], function(err, result) {
					if (err) {
						log.warn(req.method + " " + req.url + " failed.");
						res.send(400, err.message);
					} else {
						log.info({'res.body': result});
						log.info(req.method + " " + req.url + " OK.");
						res.send(result[0].toString()); //sends row id
					}
				});
			}
			me.app.post(url, postRowHandler);
			me.app.post(url + rowsExt, postRowHandler);

			//update row in table
			var putRowHandler = function(req, res) {
				log.info(req.method + " " + req.url);
				log.info({'req.body': req.body});
				var row = req.body;
				row['id'] = req.param('id');
				me.model.update(table, [row], function(err, result) {
					if (err) {
						log.warn(req.method + " " + req.url + " failed.");
						res.send(400, err.message);
					} else {
						log.info({'res.body': result});
						log.info(req.method + " " + req.url + " OK.");
						res.send(result.toString()); //sends 1
					}
				});
			}
			me.app.put(url + "/:id", putRowHandler);
			me.app.put(url + rowsExt + "/:id", putRowHandler);

			var deleteRowHandler = function(req, res) {
				log.info(req.method + " " + req.url);
				var id = req.param('id');
				me.model.delete(table, [id], function(err, result) {
					if (err) {
						log.warn(req.method + " " + req.url + " failed.");
						res.send(400, err.message);
					} else {
						log.info(req.method + " " + req.url + " OK.");
						res.send(result.toString()); //sends 1
					}
				});
			}
			me.app.delete(url + "/:id", deleteRowHandler);
			me.app.delete(url + rowsExt + "/:id", deleteRowHandler);

		});
	}
}

exports.Controller = Controller;

