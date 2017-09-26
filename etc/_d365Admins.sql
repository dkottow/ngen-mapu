CREATE VIEW [dbo].[_d365Admins] AS  
SELECT UserPrincipalName, 'System' as [Scope], null as [Account], null as [Database] FROM SystemAdmin
UNION
SELECT UserPrincipalName, 'Account' as [scope], Account.[Name] as [Account], null as [Database] FROM AccountAdmin
INNER JOIN Account on AccountAdmin.Account_id = Account.id 
UNION
SELECT UserPrincipalName, 'Database' as [scope], Account.[Name] as [Account], [Databases].[name] as [Database] FROM DatabaseOwner
INNER JOIN [Databases] on DatabaseOwner.Databases_id = [Databases].id
INNER JOIN Account on [Databases].Account_id = Account.id 
