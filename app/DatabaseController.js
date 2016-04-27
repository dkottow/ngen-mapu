var _ = require('underscore');
var url = require('url');

var log = global.log.child({'mod': 'g6.DatabaseController.js'});
var parser = require('./QueryParser.js');

function sendError(req, res, err) {
	log.error({err: err, req: req}, "DatabaseController.sendError()");
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

		//get schema 
		var getSchemaHandler = function(req, res) {
			log.info({req: req}, 'DatabaseController.getSchemaHandler()...');
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
				log.info({res: res}, '...DatabaseController.getSchema().');
			});
			//log.info(" served by " + me.seed);
			//res.send(defs);
		}
		this.router.get(me.base, getSchemaHandler);
		this.router.get(me.base + ".db", getSchemaHandler);
		
		var rowsExt = ".rows";
		_.each(me.model.tables(), function(table) {
			var tableUrl = me.base + "/" + table['name'];

			var getRowsHandler = function(req, res) {
				log.info({req: req}, 'DatabaseController.get()...');
				
				var params = {};
				_.each(req.query, function(v, k) {
					if (k[0] == '$') {
						var param = parser.parse(k + "=" + v);	
						params[param.name] = param.value;
					} else {
						params[k] = v;
					}
				});
				log.debug({params: params});

				me.model.all(table.name, {
						filter: params['$filter'] 
						, fields: params['$select'] 
						, order: params['$orderby'] 
						, limit: params['$top'] 
						, offset: params['$skip'] 
						, distinct: params['$distinct'] 
						, debug: params['debug']	
					},
					function(err, result) { 
						if (err) {
							sendError(req, res, err);
							return;
						}

						//add nextUrl if nextOffset
						if (result.nextOffset) {
							var urlObj = url.parse(req.url, true);
							urlObj.search = undefined;
							urlObj.query['$skip'] = result.nextOffset;
							result.nextUrl = url.format(urlObj)
							delete result.nextOffset;
						}

						log.trace(result);
						res.send(result); 
						log.info({res: res}, '...DatabaseController.get().');
					}
				);

			}		

			me.router.get(tableUrl, getRowsHandler);	
			me.router.get(tableUrl + rowsExt, getRowsHandler);	

			var statsExt = ".stats";
			me.router.get(tableUrl + statsExt, function(req, res) {

				log.info({req: req}, 'DatabaseController.getStats()...');
				var params = {};
				_.each(req.query, function(v, k) {
					if (k[0] == '$') {
						var param = parser.parse(k + "=" + v);	
						params[param.name] = param.value;
					} else {
						params[k] = v;
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
						log.info({res: res}, '...DatabaseController.getStats().');
					}
				);

			});	

			//insert a row into table
			var postRowHandler = function(req, res) {
				log.info({req: req}, 'DatabaseController.post()...');
				log.info({'req.body': req.body});
				var row = req.body;
				var params = req.query;
				me.model.insert(table.name, [row], params, function(err, result) {
					if (err) {
						sendError(req, res, err);
						return;
					}
					log.debug({'res.body': result});
					res.send(result); 
					log.info({res: res}, '...DatabaseController.post().');
				});
			}
			me.router.post(tableUrl, postRowHandler);
			me.router.post(tableUrl + rowsExt, postRowHandler);

			//update row in table
			var putRowHandler = function(req, res) {
				log.info({req: req}, 'DatabaseController.put()...');
				log.info({'req.body': req.body});
				var row = req.body;
				row['id'] = req.param('id');
				var params = req.query;
				me.model.update(table.name, [row], params, function(err, result) {
					if (err) {
						sendError(req, res, err);
						return;
					}
					log.debug({'res.body': result});
					res.send(result);  
					log.info({res: res}, '...DatabaseController.put().');
				});
			}
			me.router.put(tableUrl + "/:id", putRowHandler);
			me.router.put(tableUrl + rowsExt + "/:id", putRowHandler);

			//delete row in table
			var deleteRowHandler = function(req, res) {
				log.info({req: req}, 'DatabaseController.delete()...');
				var id = req.param('id');
				me.model.delete(table.name, [id], function(err, result) {
					if (err) {
						sendError(req, res, err);
						return;
					}
					res.send(result); 
					log.info({res: res}, '...DatabaseController.delete().');
				});
			}
			me.router.delete(tableUrl + "/:id", deleteRowHandler);
			me.router.delete(tableUrl + rowsExt + "/:id", deleteRowHandler);

		});

		//patch schema 
		var patchSchemaHandler = function(req, res) {
			log.info({req: req}, 'DatabaseController.patchSchema()...');
			var patches = req.body;
			me.model.patchSchema(patches, function(err, result) {
				if (err) {
					sendError(req, res, err);
					return;
				}
				log.debug({'res.body': result});
				res.send(result); 
				log.info({res: res}, '...DatabaseController.patchSchema().');
			});
			//log.info(" served by " + me.seed);
			//res.send(defs);
		}
		this.router.patch(me.base, patchSchemaHandler);
		this.router.patch(me.base + ".db", patchSchemaHandler);

		if (cbAfter) cbAfter();
	}
}

exports.DatabaseController = DatabaseController;

