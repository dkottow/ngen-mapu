var _ = require('underscore');

var log = global.log.child({'mod': 'g6.DatabaseController.js'});
var parser = require('./QueryParser.js');

function sendError(req, res, err) {
	log.error(err);
	log.warn(req.method + " " + req.url + " failed.");
	res.send(400, err.message);
}

function DatabaseController(router, restBase, model)
{	
	this.router = router;
	this.base = restBase;
	this.model = model;
	//this.seed = Math.random();
	//console.log("created DatabaseController " + this.seed);
	log.info("new DatabaseController @ " + restBase);

	this.init = function(cbAfter) {
		var me = this;

		//describe model 
		var defsHandler = function(req, res) {
			log.info(req.method + " " + req.url);
			me.model.getSchema(function(err, result) {
				if (err) {
					sendError(req, res, err);
					return;
				}
				_.each(result.tables, function(t) {
					t['url'] = me.base + "/" + t['name'];
				});
				log.debug(result);
				res.send(result); 
			});
			//log.info(" served by " + me.seed);
			//res.send(defs);
		}
		this.router.get(me.base, defsHandler);
		this.router.get(me.base + ".db", defsHandler);
		
		var rowsExt = ".rows";
		_.each(me.model.tables(), function(table) {
			var url = me.base + "/" + table['name'];

			var getRowsHandler = function(req, res) {
				log.info(req.method + " " + req.url);
				
				var params = {};
				_.each(req.query, function(v, k) {
					if (k[0] == '$') {
						var param = parser.parse(k + "=" + v);	
						params[param.name] = param.value;
						//console.log(param);
					}
				});

				me.model.all(table.name, {
						filter: params['$filter'], 
						fields: params['$select'], 
						order: params['$orderby'], 
						limit: params['$top'], 
						offset: params['$skip'], 
						distinct: params['$distinct'] 
					},
					function(err, result) { 
						if (err) {
							sendError(req, res, err);
							return;
						}
						log.debug(result);
						res.send(result); 
					}
				);

			}		

			me.router.get(url, getRowsHandler);	
			me.router.get(url + rowsExt, getRowsHandler);	

			var statsExt = ".stats";
			me.router.get(url + statsExt, function(req, res) {

				var params = {};
				_.each(req.query, function(v, k) {
					if (k[0] == '$') {
						var param = parser.parse(k + "=" + v);	
						params[param.name] = param.value;
						//console.log(param);
					}
				});

				me.model.getStats(table.name, { 
						filter: params['$filter'], 
						fields: params['$select'] 
					}, 
					function(err, result) {
						if (err) {
							sendError(req, res, err);
							return;
						}
						log.debug(result);
						res.send(result); 
					}
				);

			});	


			//select one specific 'root' row
			//and include recursively all children / supertypes 
			//upto depth levels  
			var getDeepHandler = function(req, res) {
				log.info(req.method + " " + req.url);
				var filters = [{ 'field': 'id', 
							   'operator': 'eq', 
							   'value' : req.param('id')
					}];
				me.model.getDeep(table.name, {
									filter: filters,
									depth: req.query['depth'] 
								}
								, function(err, result) { 
					if (err) {
						sendError(req, res, err);
						return;
					}
					log.debug(result);
					res.send(result); 
				});
			}		
			me.router.get(url + "/:id", getDeepHandler);
			me.router.get(url + rowsExt + "/:id", getDeepHandler);

			//insert a row into table
			var postRowHandler = function(req, res) {
				log.info(req.method + " " + req.url);
				log.info({'req.body': req.body});
				var row = req.body;
				me.model.insert(table.name, [row], function(err, result) {
					if (err) {
						sendError(req, res, err);
						return;
					}
					log.info({'res.body': result});
					log.info(req.method + " " + req.url + " OK.");
					res.send({id: result[0].toString()}); //send row id
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
				me.model.update(table.name, [row], function(err, result) {
					if (err) {
						sendError(req, res, err);
						return;
					}
					log.info({'res.body': result});
					log.info(req.method + " " + req.url + " OK.");
					res.send({});  
				});
			}
			me.router.put(url + "/:id", putRowHandler);
			me.router.put(url + rowsExt + "/:id", putRowHandler);

			//delete row in table
			var deleteRowHandler = function(req, res) {
				log.info(req.method + " " + req.url);
				var id = req.param('id');
				me.model.delete(table.name, [id], function(err, result) {
					if (err) {
						sendError(req, res, err);
						return;
					}
					log.info(req.method + " " + req.url + " OK.");
					res.send({}); 
				});
			}
			me.router.delete(url + "/:id", deleteRowHandler);
			me.router.delete(url + rowsExt + "/:id", deleteRowHandler);

		});
		if (cbAfter) cbAfter();
	}
}

exports.DatabaseController = DatabaseController;

