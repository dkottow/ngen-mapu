var _ = require('underscore');

var log = global.log.child({'mod': 'g6.controller.js'});

function Controller(router, restBase, model)
{	
	this.router = router;
	this.base = restBase;
	this.model = model;
	//this.seed = Math.random();
	//console.log("created Controller " + this.seed);
	log.info("Rest controller @ " + restBase);

	this.init = function() {
		var me = this;

		//describe database 
		var defsHandler = function(req, res) {
			log.info(req.method + " " + req.url);
			me.model.getSchema(function(err, result) {
				if (err) {
					log.warn(err);
					res.send(400, err.message);
				} else {
					_.each(result, function(t) {
						t['url'] = me.base + "/" + t['name'];
					});
					log.debug(result);
					res.send(result); 
				}
			});
			//log.info(" served by " + me.seed);
			//res.send(defs);
		}
		this.router.get(me.base, defsHandler);
		this.router.get(me.base + ".db", defsHandler);
		
		var rowsExt = ".rows";
		_.each(me.model.tables, function(table) {
			var url = me.base + "/" + table['name'];

			//select all table rows 
//TODO add filter by field value 
			//	can be filtered by some *ancestor* table id 
			//	given in query string. 
			//
			//		e.g. 
			//			given table tree: borehole > rock > fracture
			//
			//			/[base]/fracture?borehole=1 
			//			 will give you all fractures (of all rocks) 
			//			 belonging to borehole.id=1	
			//
			//  while	/[base]/fracture?rock=3
			//			will give you all fractures of rock.id=3

			var getRowsHandler = function(req, res) {
				log.info(req.method + " " + req.url);
				
				var filterClause = {};
				var filterAncestor = {};
				if (req.query['ff'] && req.query['fv']) {
					if (req.query['ff'].indexOf(".") > 0) {
						filterAncestor[ req.query['ff'].split('.')[0] ] 
							= req.query['fv'];

					} else {
						filterClause['field'] = req.query['ff'];
						filterClause['value'] = req.query['fv'];
						if (req.query['fop']) {	
							filterClause['op'] = req.query['fop'];
						} else {
							filterClause['op'] = 'equal';
						}
					}
				}

				var order = {};
				if (req.query['oasc']) {
					order[ req.query['oasc'] ] = 'asc';
				} else if (req.query['odesc']) {
					order[ req.query['odesc'] ] = 'desc';
				}

				var limit = global.row_max_count;
				if (req.query['off']) {
					limit = req.query['off'] + "," + limit;
				}

				me.model.all(filterClause, filterAncestor, table, '*', order, limit, function(err, result) { 
					if (err) {
						log.warn(err);
						res.send(400, err.message);
					} else {
						log.debug(result);
						res.send(result); 
					}
				});
			}		

			me.router.get(url, getRowsHandler);	
			me.router.get(url + rowsExt, getRowsHandler);	

			//select one specific 'root' row
			//and include recursively all children / supertypes 
			//upto depth levels  
			var getDeepHandler = function(req, res) {
				log.info(req.method + " " + req.url);
				var filter = { 'field': 'id', 
							   'op': 'equal', 
							   'value' : req.param('id')
					};
				var depth = req.query['depth'] || 3;
				me.model.getDeep(depth, filter, table, '*'
								, function(err, result) { 
					if (err) {
						log.warn(err);
						res.send(400, err.message);
					} else {
						if (req.query['pretty']) {
							result = JSON.stringify(result, null, '\t');
						}
						log.debug(result);
						res.send(result); 
					}
				});
			}		
			me.router.get(url + "/:id", getDeepHandler);
			me.router.get(url + rowsExt + "/:id", getDeepHandler);

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
			me.router.post(url, postRowHandler);
			me.router.post(url + rowsExt, postRowHandler);

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
			me.router.put(url + "/:id", putRowHandler);
			me.router.put(url + rowsExt + "/:id", putRowHandler);

			//delete row in table
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
			me.router.delete(url + "/:id", deleteRowHandler);
			me.router.delete(url + rowsExt + "/:id", deleteRowHandler);

		});
	}
}

exports.Controller = Controller;

