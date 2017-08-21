
CREATE VIEW [dbo].[vs_Admins] AS  

SELECT UserPrincipalName, 'System' AS [Scope], null AS [Account], null AS [Database] FROM SystemAdmin

UNION

SELECT UserPrincipalName, 'Account' AS [scope], Account.[Name] AS [Account], null AS [Database] FROM AccountAdmin
INNER JOIN Account ON AccountAdmin.Account_id = Account.id 

UNION

SELECT UserPrincipalName, 'Database' AS [scope], Account.[Name] AS [Account], [Databases].[name] AS [Database] FROM DatabaseOwner
INNER JOIN [Databases] ON DatabaseOwner.Databases_id = [Databases].id
INNER JOIN Account ON [Databases].Account_id = Account.id 
