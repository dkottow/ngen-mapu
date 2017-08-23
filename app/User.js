
var _ = require('underscore');
var util = require('util');

var Table = require('./Table.js').Table;

var log = require('./log.js').log;

var User = function(userPrincipalName, masterDatabase) {
    this.userPrincipalName = userPrincipalName;
    this.master = masterDatabase;
    this.cache = { access: {}, admin: {} };
}

User.TABLES = {
    ACCESS: '__data365Users'
};

User.FIELDS = {
    PRINCIPAL: 'UserPrincipalName',
    ACCESS_SCOPE: 'Scope'
};

User.VIEWS = {
    ACCESS_ADMIN : 'vs_Admins'
};

User.PROCEDURES = {
    ACCESS_USER: 'd365_Access'
}

User.prototype.name = function() {
    return this.userPrincipalName;
}

User.prototype.isAdmin = function(opts) {
	var me = this;
    return new Promise(function(resolve, reject) {
		me.isAdminCB(opts, function(err, result) {
			if (err) reject(err);
			else resolve(result); 
		});
	});
}

User.prototype.isAdminCB = function(opts, cbResult) {
    var me = this;
    try {        
        log.debug({user: this.name(), opts: opts}, "User.isAdmin()...");
		cbResult = cbResult || arguments[arguments.length - 1];	
		opts = typeof opts == 'object' ? opts : {};		

        var optsKey = JSON.stringify(_.pick(opts, ['account', 'database']));
        if (this.cache.admin[optsKey]) {
            log.debug("User.isAdmin() cached.");
            cbResult(null, this.cache.admin[optsKey]);
            return;
        }      

        var viewOpts = {
            filter: [{
                field: User.FIELDS.PRINCIPAL,
                op: 'eq',
                value: this.userPrincipalName
            }]
        };
        this.master._init(function(err) {

            if (err) {
                cbResult(err);
                return;                
            }
            me.master.allView(User.VIEWS.ACCESS_ADMIN, viewOpts, function(err, result) {
    			log.trace({result: result}, 'User.isAdmin() result');
                if (err) {
                    cbResult(err);
                    return;
                }
                var row = _.find(result.rows, function(row) {
                    return row.Scope == 'System' 
                    || (row.Scope == 'Account' && opts.account == row.Account)
                    || (row.Scope == 'Database' && opts.account == row.Account && opts.database == row.Database)
                });
                me.cache.admin[optsKey] = Boolean(row);
                log.debug({ result: Boolean(row) }, "...User.isAdmin()");
                cbResult(null, Boolean(row));
            });
        });

    } catch(err) {
        return cbResult(err);
    }
}

User.prototype.access = function(db, opts) {
	var me = this;
	return new Promise(function(resolve, reject) {
		me.accessCB(db, opts, function(err, result) {
            if (err) reject(err);
			else resolve(result); 
		});
	});
}

User.prototype.accessCB = function(db, opts, cbResult) {
    try {
        var me = this;
        log.debug({user: this.name(), opts: opts}, "User.access()...");
		cbResult = cbResult || arguments[arguments.length - 1];	
		opts = typeof opts == 'object' ? opts : {};		

        var optsKey = JSON.stringify(_.pick(opts, ['table']));
        if (this.cache.access[optsKey]) {
            log.debug("User.access() cached.");
            cbResult(null, this.cache.access[optsKey]);
            return;
        }      

        var args = {
            input: [
                {
                    name: User.FIELDS.PRINCIPAL,
                    value: this.userPrincipalName
                },
                {
                    name: Table.FIELDS.ACCESS_TABLE,
                    value: opts.table
                },
            ],
            output: [
                { name: Table.FIELDS.ACCESS_READ, type: 'text' },
                { name: Table.FIELDS.ACCESS_WRITE, type: 'text' },
            ]
        };
        db._init(function(err) {
            if (err) {
                cbResult(err);
                return;                
            }
            db.execSP(User.PROCEDURES.ACCESS_USER, args, function(err, result) {
    			log.trace({result: result}, 'User.access() SP result');
                if (err) {
                    cbResult(err);
                    return;
                }
                result.output.table = opts.table;
                me.cache.access[optsKey] = result.output;
    			log.debug({result: result.output}, '...User.access()');
                cbResult(null, result.output);
            });
        });

    } catch(err) {
        return cbResult(err);
    }
}

exports.User = User;
