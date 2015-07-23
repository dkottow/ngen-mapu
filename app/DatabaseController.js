var _ = require('underscore');

var log = global.log.child({'mod': 'g6.DatabaseController.js'});

function DatabaseController(router, restBase, model)
{	
	this.router = router;
	this.base = restBase;
	this.model = model;
	//this.seed = Math.random();
	//console.log("created DatabaseController " + this.seed);
	log.info("new DatabaseController @ " + restBase);

	this.getFilterClauses = function(req) {
		var filterClauses = [];
		//console.dir(req.query['$filter']);
		if (req.query['$filter']) {
			var clauses = req.query['$filter'].split('and');
			_.each(clauses, function(clause) {
				var filter = {};
				var fq = clause.trim().split(' ');
				if (fq[0].indexOf(".") > 0) {
					filter.table = fq[0].split('.')[0];
					filter.field = fq[0].split('.')[1];
				} else {
					filter.field = fq[0];
				}
				filter.operator = fq[1];
				filter.value = fq[2];

				filterClauses.push(filter);
			});
		}				
		return filterClauses;
	}

	this.init = function(cbAfter) {
		var me = this;

		//describe model 
		var defsHandler = function(req, res) {
			log.info(req.method + " " + req.url);
			me.model.getSchema(function(err, result) {
				if (err) {
					log.warn(err);
					res.send(400, err.message);
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
				
				var filterClauses = me.getFilterClauses(req);

				var orderClauses = [];
				if (req.query['$orderby']) {
					var orderBy = req.query['$orderby'].split(' ');
					var order = {};
					var fld = orderBy[0];
					order[fld] = 'ASC';
					if (orderBy.length > 1) {
						order[fld] = orderBy[1];
					}
					orderClauses.push(order);
				}

				var limit = global.row_max_count;
				if (req.query['$top']) {
					limit = req.query['$top'];
				}
				if (req.query['$skip']) {
					limit = req.query['$skip'] + "," + limit;
				}

				me.model.all(table, filterClauses, '*', 
							 orderClauses, limit, function(err, result) { 
					if (err) {
						log.warn(err);
						res.send(400, err.message);
						return;
					}
					log.debug(result);
					res.send(result); 
				});
			}		

			me.router.get(url, getRowsHandler);	
			me.router.get(url + rowsExt, getRowsHandler);	

			var statsExt = ".stats";
			me.router.get(url + statsExt, function(req, res) {

				var filterClauses = me.getFilterClauses(req);

				me.model.getStats(table, filterClauses, function(err, result) {
					if (err) {
						log.warn(err);
						res.send(400, err.message);
						return;
					}
					log.debug(result);
					res.send(result); 
				});

			});	


			//select one specific 'root' row
			//and include recursively all children / supertypes 
			//upto depth levels  
			var getDeepHandler = function(req, res) {
				log.info(req.method + " " + req.url);
				var filter = { 'field': 'id', 
							   'operator': 'eq', 
							   'value' : req.param('id')
					};
				var depth = req.query['depth'] || 3;
				me.model.getDeep(table, [filter], '*', depth
								, function(err, result) { 
					if (err) {
						log.warn(err);
						res.send(400, err.message);
						return;
					}
					if (req.query['pretty']) {
						result = JSON.stringify(result, null, '\t');
					}
					log.debug(result);
					res.send(result); 
				});
			}		
			me.router.get(url + "/:id", getDeepHandler);
			me.router.get(url + rowsExt + "/:id", getDeepHandler);


/*
			var distinctExt = ".uniq";
			me.router.get(url + distinctExt + "/:field", function(req, res) {
			});
*/

			//insert a row into table
			var postRowHandler = function(req, res) {
				log.info(req.method + " " + req.url);
				log.info({'req.body': req.body});
				var row = req.body;
				me.model.insert(table, [row], function(err, result) {
					if (err) {
						log.warn(req.method + " " + req.url + " failed.");
						res.send(400, err.message);
						return;
					}
					log.info({'res.body': result});
					log.info(req.method + " " + req.url + " OK.");
					res.send(result[0].toString()); //sends row id
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
						return;
					}
					log.info({'res.body': result});
					log.info(req.method + " " + req.url + " OK.");
					res.send(result.toString()); //sends 1
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
						return;
					}
					log.info(req.method + " " + req.url + " OK.");
					res.send(result.toString()); //sends 1
				});
			}
			me.router.delete(url + "/:id", deleteRowHandler);
			me.router.delete(url + rowsExt + "/:id", deleteRowHandler);

		});
		if (cbAfter) cbAfter();
	}
}

exports.DatabaseController = DatabaseController;

