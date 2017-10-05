
var _ = require('underscore');
var util = require('util');

var Table = require('./Table.js').Table;

var log = require('./log.js').log;

var User = function(userPrincipalName, masterDatabase) {
    this._name = userPrincipalName;
    this.master = masterDatabase;
    //this.cache = { access: {}, admin: {} };
}

User.FIELDS = {
    NAME: 'UserPrincipalName',
    PRINCIPAL: 'Principal'
};

User.VIEWS = {
    ACCESS_ADMIN : '_d365Admins'
};

User.PROCEDURES = {
    ACCESS_USER: '_d365Access'
}

User.EVERYONE = 'Everyone'; //used in AccessControl.filterQuery and Database.rowsOwned
User.NOBODY = 'unknown';
User.SYSTEM = 'system';

User.prototype.name = function() {
    return this._name || User.NOBODY;
}

User.SystemUser = function() {
    return new User(User.SYSTEM);
}

User.prototype.principal = function() {
    return this._principal || this._name || User.EVERYONE;
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
        if (this._admin !== undefined) {
            cbResult(null, this._admin);
            return;
        }

        var viewOpts = {
            filter: [{
                field: User.FIELDS.NAME,
                op: 'eq',
                value: this._name
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
                me._admin = Boolean(row);
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
        if (this._access !== undefined) {
            log.debug("User.access() cached.");
            cbResult(null, this._access);
            return;            
        }

        var args = {
            input: [
                {
                    name: User.FIELDS.NAME,
                    value: this._name
                },
                {
                    name: Table.FIELDS.ACCESS_TABLE,
                    value: opts.table
                },
            ],
            output: [
                { name: Table.FIELDS.ACCESS_READ, type: 'text' },
                { name: Table.FIELDS.ACCESS_WRITE, type: 'text' },
                { name: User.FIELDS.PRINCIPAL, type: 'text' },
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
                me._access = result.output;
                me._principal = result.output[User.FIELDS.PRINCIPAL];
    			log.debug({result: result.output}, '...User.access()');
                cbResult(null, result.output);
            });
        });

    } catch(err) {
        return cbResult(err);
    }
}

exports.User = User;
