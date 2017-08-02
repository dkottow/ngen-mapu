

var user = {
    "sysAdmin" : true,
    "accountAdmin": [],
    "databaseOwner": [],
}


var User = function(userPrincipalName, options) {
    this.userPrincipalName = userPrincipalName;
    options = options || {};
    this.admin = {
        system: options.admin || false,
        accounts: options.accounts || [],
        databases: options.databases || [],
    };
}

User.prototype.isAdmin = function(account, db) {
    if (this.admin.system) return true;
    if (_.contains(this.admin.accounts, account.name)) return true;
    if (db && _.contains(this.admin.databases, db.name())) return true;
    return false;
}

User.prototype.access = function(account, db, table) {
    //return {read: all/own/none, write: all/own/none }
}
