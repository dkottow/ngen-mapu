CREATE TABLE __schemaprops__ ( name VARCHAR(256) NOT NULL, 	value VARCHAR(MAX), 	PRIMARY KEY (name) );

CREATE TABLE __tableprops__ ( name VARCHAR(256) NOT NULL, 	props VARCHAR(MAX),  disabled INTEGER DEFAULT 0, 	PRIMARY KEY (name) );

 CREATE TABLE __fieldprops__ ( table_name VARCHAR(256) NOT NULL,  name VARCHAR(256) NOT NULL,  props VARCHAR(MAX),  disabled INTEGER DEFAULT 0,  PRIMARY KEY (name, table_name) );



INSERT INTO __schemaprops__ ("name","value")  VALUES ('join_trees', '[{"tables":["customers","orders","products","products_in_orders"],"joins":[{"v":"orders","w":"customers"},{"v":"products_in_orders","w":"orders"},{"v":"products_in_orders","w":"products"}]}]'),('users', '[{"name":"anon@donkeylift.com","role":"reader"},{"name":"demo@donkeylift.com","role":"owner"},{"name":"admin@donkeylift.com","role":"owner"}]'); 
INSERT INTO __tableprops__ ("name","props","disabled")  VALUES ('customers','{"row_alias":["name","email"],"access_control":[{"role":"reader","write":"none","read":"all"},{"role":"writer","write":"own","read":"all"}]}',0); 
INSERT INTO __fieldprops__ ([name],[table_name],[props],[disabled])  VALUES ('id','customers','{"order":0,"width":4}',0); 
INSERT INTO __fieldprops__ ([name],[table_name],[props],[disabled])  VALUES ('name','customers','{"order":1,"width":40}',0); 
INSERT INTO __fieldprops__ ([name],[table_name],[props],[disabled])  VALUES ('email','customers','{"order":2,"width":60}',0); 
INSERT INTO __fieldprops__ ([name],[table_name],[props],[disabled])  VALUES ('mod_by','customers','{"order":91,"width":20}',0); 
INSERT INTO __fieldprops__ ([name],[table_name],[props],[disabled])  VALUES ('mod_on','customers','{"order":92,"width":11}',0); 
INSERT INTO __fieldprops__ ([name],[table_name],[props],[disabled])  VALUES ('add_by','customers','{"order":93,"width":20}',0); 
INSERT INTO __fieldprops__ ([name],[table_name],[props],[disabled])  VALUES ('add_on','customers','{"order":94,"width":11}',0); 
INSERT INTO __fieldprops__ ([name],[table_name],[props],[disabled])  VALUES ('own_by','customers','{"order":95,"width":20}',0); 
INSERT INTO __tableprops__ ("name","props","disabled")  VALUES ('products','{"row_alias":["name"],"access_control":[{"role":"reader","write":"none","read":"all"},{"role":"writer","write":"own","read":"all"}]}',0); 
INSERT INTO __fieldprops__ ([name],[table_name],[props],[disabled])  VALUES ('id','products','{"order":0,"width":4}',0); 
INSERT INTO __fieldprops__ ([name],[table_name],[props],[disabled])  VALUES ('name','products','{"order":1,"width":30}',0); 
INSERT INTO __fieldprops__ ([name],[table_name],[props],[disabled])  VALUES ('price','products','{"order":2,"width":8,"scale":2}',0); 
INSERT INTO __fieldprops__ ([name],[table_name],[props],[disabled])  VALUES ('mod_by','products','{"order":91,"width":20}',0); 
INSERT INTO __fieldprops__ ([name],[table_name],[props],[disabled])  VALUES ('mod_on','products','{"order":92,"width":11}',0); 
INSERT INTO __fieldprops__ ([name],[table_name],[props],[disabled])  VALUES ('add_by','products','{"order":93,"width":20}',0); 
INSERT INTO __fieldprops__ ([name],[table_name],[props],[disabled])  VALUES ('add_on','products','{"order":94,"width":11}',0); 
INSERT INTO __fieldprops__ ([name],[table_name],[props],[disabled])  VALUES ('own_by','products','{"order":95,"width":20}',0); 
INSERT INTO __tableprops__ ("name","props","disabled")  VALUES ('orders','{"row_alias":["order_date","customers.name"],"access_control":[{"role":"reader","write":"none","read":"all"},{"role":"writer","write":"own","read":"all"}]}',0); 
INSERT INTO __fieldprops__ ([name],[table_name],[props],[disabled])  VALUES ('id','orders','{"order":0,"width":4}',0); 
INSERT INTO __fieldprops__ ([name],[table_name],[props],[disabled])  VALUES ('order_date','orders','{"order":1,"width":16}',0); 
INSERT INTO __fieldprops__ ([name],[table_name],[props],[disabled])  VALUES ('customer_id','orders','{"order":2,"width":40}',0); 
INSERT INTO __fieldprops__ ([name],[table_name],[props],[disabled])  VALUES ('total_amount','orders','{"order":3,"width":12,"scale":2}',0); 
INSERT INTO __fieldprops__ ([name],[table_name],[props],[disabled])  VALUES ('mod_by','orders','{"order":91,"width":20}',0); 
INSERT INTO __fieldprops__ ([name],[table_name],[props],[disabled])  VALUES ('mod_on','orders','{"order":92,"width":11}',0); 
INSERT INTO __fieldprops__ ([name],[table_name],[props],[disabled])  VALUES ('add_by','orders','{"order":93,"width":20}',0); 
INSERT INTO __fieldprops__ ([name],[table_name],[props],[disabled])  VALUES ('add_on','orders','{"order":94,"width":11}',0); 
INSERT INTO __fieldprops__ ([name],[table_name],[props],[disabled])  VALUES ('own_by','orders','{"order":95,"width":20}',0); 
INSERT INTO __tableprops__ ("name","props","disabled")  VALUES ('products_in_orders','{"row_alias":[],"access_control":[{"role":"reader","write":"none","read":"all"},{"role":"writer","write":"own","read":"all"}]}',0); 
INSERT INTO __fieldprops__ ([name],[table_name],[props],[disabled])  VALUES ('id','products_in_orders','{"order":0,"width":4}',0); 
INSERT INTO __fieldprops__ ([name],[table_name],[props],[disabled])  VALUES ('order_id','products_in_orders','{"order":1,"width":40}',0); 
INSERT INTO __fieldprops__ ([name],[table_name],[props],[disabled])  VALUES ('product_id','products_in_orders','{"order":2,"width":30}',0); 
INSERT INTO __fieldprops__ ([name],[table_name],[props],[disabled])  VALUES ('unit_price','products_in_orders','{"order":3,"width":8,"scale":2}',0); 
INSERT INTO __fieldprops__ ([name],[table_name],[props],[disabled])  VALUES ('quantity','products_in_orders','{"order":4,"width":4}',0); 
INSERT INTO __fieldprops__ ([name],[table_name],[props],[disabled])  VALUES ('mod_by','products_in_orders','{"order":91,"width":20}',0); 
INSERT INTO __fieldprops__ ([name],[table_name],[props],[disabled])  VALUES ('mod_on','products_in_orders','{"order":92,"width":11}',0); 
INSERT INTO __fieldprops__ ([name],[table_name],[props],[disabled])  VALUES ('add_by','products_in_orders','{"order":93,"width":20}',0); 
INSERT INTO __fieldprops__ ([name],[table_name],[props],[disabled])  VALUES ('add_on','products_in_orders','{"order":94,"width":11}',0); 
INSERT INTO __fieldprops__ ([name],[table_name],[props],[disabled])  VALUES ('own_by','products_in_orders','{"order":95,"width":20}',0); 

CREATE TABLE products(
"id" INTEGER NOT NULL  ,
"name" VARCHAR(MAX)  ,
"price" NUMERIC(8,2)  ,
"mod_by" VARCHAR(64) DEFAULT 'sql' ,
"mod_on" DATETIME DEFAULT GETDATE() ,
"add_by" VARCHAR(64) DEFAULT 'sql' ,
"add_on" DATETIME DEFAULT GETDATE() ,
"own_by" VARCHAR(64)  ,
 PRIMARY KEY (id)
);
CREATE TABLE customers(
"id" INTEGER NOT NULL  ,
"name" VARCHAR(MAX)  ,
"email" VARCHAR(256)  ,
"mod_by" VARCHAR(64) DEFAULT 'sql' ,
"mod_on" DATETIME DEFAULT GETDATE() ,
"add_by" VARCHAR(64) DEFAULT 'sql' ,
"add_on" DATETIME DEFAULT GETDATE() ,
"own_by" VARCHAR(64)  ,
 PRIMARY KEY (id)
);
CREATE TABLE orders(
"id" INTEGER NOT NULL  ,
"order_date" DATE  ,
"customer_id" INTEGER NOT NULL  REFERENCES customers(id),
"total_amount" NUMERIC(8,2)  ,
"mod_by" VARCHAR(64) DEFAULT 'sql' ,
"mod_on" DATETIME DEFAULT GETDATE() ,
"add_by" VARCHAR(64) DEFAULT 'sql' ,
"add_on" DATETIME DEFAULT GETDATE() ,
"own_by" VARCHAR(64)  ,
 PRIMARY KEY (id)
);
CREATE TABLE products_in_orders(
"id" INTEGER NOT NULL  ,
"order_id" INTEGER NOT NULL  REFERENCES orders(id),
"product_id" INTEGER NOT NULL  REFERENCES products(id),
"unit_price" NUMERIC(8,2)  ,
"quantity" INTEGER  ,
"mod_by" VARCHAR(64) DEFAULT 'sql' ,
"mod_on" DATETIME DEFAULT GETDATE() ,
"add_by" VARCHAR(64) DEFAULT 'sql' ,
"add_on" DATETIME DEFAULT GETDATE() ,
"own_by" VARCHAR(64)  ,
 PRIMARY KEY (id)
);






