CREATE PROCEDURE [dbo].[d365_Access] 
	-- Add the parameters for the stored procedure here
	@UserPrincipalName varchar(256),
	@TableName varchar(256) = null,
	@Read varchar(16) OUTPUT,
	@Write varchar(16) OUTPUT
AS
BEGIN
	
	DECLARE @ur varchar(16), @uw varchar(16)
	DECLARE @tr varchar(16), @tw varchar(16)

	SET NOCOUNT ON;

	SELECT TOP 1 @ur = [Read], @uw = [Write] FROM 
	(
		SELECT 1 AS ord, AR.[Name] AS [Read], AW.[Name] AS [Write] FROM __d365Users U 
		INNER JOIN __d365AccessScope AR ON U.Read_id = AR.id
		INNER JOIN __d365AccessScope AW ON U.Write_id = AW.id
		WHERE UserPrincipalName = @UserPrincipalName
	UNION
		SELECT 2 AS ord, AR.[Name] AS [Read], AW.[Name] AS [Write] FROM __d365Users U 
		INNER JOIN __d365AccessScope AR ON U.Read_id = AR.id
		INNER JOIN __d365AccessScope AW ON U.Write_id = AW.id
		WHERE UserPrincipalName = 'Everyone'
	) AS T ORDER BY ord;

	SET @Read = COALESCE(@ur, 'none');
	SET @Write = COALESCE(@uw, 'none');

	IF @ur IS NOT null AND @TableName IS NOT null 
	BEGIN
		SELECT @tr = AR.[Name], @tw = AW.[Name] FROM __d365TableAccess  T 
		INNER JOIN __d365AccessScope AR ON T.Read_id = AR.id
		INNER JOIN __d365AccessScope AW ON T.Write_id = AW.id
		WHERE TableName = @TableName;
		SET @Read = CASE WHEN @tr is not null THEN @tr ELSE @Read END;
		SET @Write = CASE WHEN @tw is not null THEN @tw ELSE @Write END;
	END 

END
