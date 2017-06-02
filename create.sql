PRAGMA journal_mode=WAL;

CREATE TABLE __schemaprops__ ( name VARCHAR NOT NULL, 	value VARCHAR, 	PRIMARY KEY (name) );

CREATE TABLE __tableprops__ ( name VARCHAR NOT NULL, 	props VARCHAR,  disabled INTEGER DEFAULT 0, 	PRIMARY KEY (name) );

 CREATE TABLE __fieldprops__ ( table_name VARCHAR(256) NOT NULL,  name VARCHAR NOT NULL,  props VARCHAR,  disabled INTEGER DEFAULT 0,  PRIMARY KEY (name, table_name) );



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
INSERT INTO __fieldprops__ ([name],[table_name],[props],[disabled])  VALUES ('order_date','orders','{"order":1,"width":8}',0); 
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
"id" INTEGER  NOT NULL  ,
"name" VARCHAR  ,
"price" DECIMAL(8,2)  ,
"mod_by" VARCHAR(64) DEFAULT 'sql' ,
"mod_on" DATETIME DEFAULT(datetime('now')) ,
"add_by" VARCHAR(64) DEFAULT 'sql' ,
"add_on" DATETIME DEFAULT(datetime('now')) ,
"own_by" VARCHAR(64)  ,
 PRIMARY KEY (id)
);
CREATE TABLE customers(
"id" INTEGER  NOT NULL  ,
"name" VARCHAR  ,
"email" VARCHAR(256)  ,
"mod_by" VARCHAR(64) DEFAULT 'sql' ,
"mod_on" DATETIME DEFAULT(datetime('now')) ,
"add_by" VARCHAR(64) DEFAULT 'sql' ,
"add_on" DATETIME DEFAULT(datetime('now')) ,
"own_by" VARCHAR(64)  ,
 PRIMARY KEY (id)
);
CREATE TABLE orders(
"id" INTEGER  NOT NULL  ,
"order_date" DATE  ,
"customer_id" INTEGER NOT NULL  REFERENCES customers(id),
"total_amount" DECIMAL(8,2)  ,
"mod_by" VARCHAR(64) DEFAULT 'sql' ,
"mod_on" DATETIME DEFAULT(datetime('now')) ,
"add_by" VARCHAR(64) DEFAULT 'sql' ,
"add_on" DATETIME DEFAULT(datetime('now')) ,
"own_by" VARCHAR(64)  ,
 PRIMARY KEY (id)
);
CREATE TABLE products_in_orders(
"id" INTEGER  NOT NULL  ,
"order_id" INTEGER NOT NULL  REFERENCES orders(id),
"product_id" INTEGER NOT NULL  REFERENCES products(id),
"unit_price" DECIMAL(8,2)  ,
"quantity" INTEGER  ,
"mod_by" VARCHAR(64) DEFAULT 'sql' ,
"mod_on" DATETIME DEFAULT(datetime('now')) ,
"add_by" VARCHAR(64) DEFAULT 'sql' ,
"add_on" DATETIME DEFAULT(datetime('now')) ,
"own_by" VARCHAR(64)  ,
 PRIMARY KEY (id)
);

CREATE VIRTUAL TABLE fts_products USING fts4(content, tokenize=simple "tokenchars=-");

CREATE TRIGGER tgr_products_ai AFTER INSERT ON products BEGIN
 INSERT INTO fts_products (docid, content)  SELECT products.id AS docid, COALESCE(products.[id], '') || ' ' || COALESCE(products.[name], '') || ' ' || COALESCE(products.[price], '') || ' ' || COALESCE(products.[mod_by], '') || ' ' || COALESCE(products.[mod_on], '') || ' ' || COALESCE(products.[add_by], '') || ' ' || COALESCE(products.[add_on], '') || ' ' || COALESCE(products.[own_by], '') || ' ' || COALESCE(vra_products.ref, '') as content FROM products, vra_products WHERE products.id = new.id AND vra_products.id = products.id;
END;

CREATE TRIGGER tgr_products_bu  BEFORE UPDATE ON products BEGIN
 DELETE FROM fts_products WHERE docid = old.id;
END;

CREATE TRIGGER tgr_products_au AFTER UPDATE ON products BEGIN
 INSERT INTO fts_products (docid, content)  SELECT products.id AS docid, COALESCE(products.[id], '') || ' ' || COALESCE(products.[name], '') || ' ' || COALESCE(products.[price], '') || ' ' || COALESCE(products.[mod_by], '') || ' ' || COALESCE(products.[mod_on], '') || ' ' || COALESCE(products.[add_by], '') || ' ' || COALESCE(products.[add_on], '') || ' ' || COALESCE(products.[own_by], '') || ' ' || COALESCE(vra_products.ref, '') as content FROM products, vra_products WHERE products.id = new.id AND vra_products.id = products.id;
END;

CREATE TRIGGER tgr_products_bd  BEFORE DELETE ON products BEGIN
 DELETE FROM fts_products WHERE docid = old.id;
END;


CREATE VIRTUAL TABLE fts_customers USING fts4(content, tokenize=simple "tokenchars=-");

CREATE TRIGGER tgr_customers_ai AFTER INSERT ON customers BEGIN
 INSERT INTO fts_customers (docid, content)  SELECT customers.id AS docid, COALESCE(customers.[id], '') || ' ' || COALESCE(customers.[name], '') || ' ' || COALESCE(customers.[email], '') || ' ' || COALESCE(customers.[mod_by], '') || ' ' || COALESCE(customers.[mod_on], '') || ' ' || COALESCE(customers.[add_by], '') || ' ' || COALESCE(customers.[add_on], '') || ' ' || COALESCE(customers.[own_by], '') || ' ' || COALESCE(vra_customers.ref, '') as content FROM customers, vra_customers WHERE customers.id = new.id AND vra_customers.id = customers.id;
END;

CREATE TRIGGER tgr_customers_bu  BEFORE UPDATE ON customers BEGIN
 DELETE FROM fts_customers WHERE docid = old.id;
END;

CREATE TRIGGER tgr_customers_au AFTER UPDATE ON customers BEGIN
 INSERT INTO fts_customers (docid, content)  SELECT customers.id AS docid, COALESCE(customers.[id], '') || ' ' || COALESCE(customers.[name], '') || ' ' || COALESCE(customers.[email], '') || ' ' || COALESCE(customers.[mod_by], '') || ' ' || COALESCE(customers.[mod_on], '') || ' ' || COALESCE(customers.[add_by], '') || ' ' || COALESCE(customers.[add_on], '') || ' ' || COALESCE(customers.[own_by], '') || ' ' || COALESCE(vra_customers.ref, '') as content FROM customers, vra_customers WHERE customers.id = new.id AND vra_customers.id = customers.id;
END;

CREATE TRIGGER tgr_customers_bd  BEFORE DELETE ON customers BEGIN
 DELETE FROM fts_customers WHERE docid = old.id;
END;


CREATE VIRTUAL TABLE fts_orders USING fts4(content, tokenize=simple "tokenchars=-");

CREATE TRIGGER tgr_orders_ai AFTER INSERT ON orders BEGIN
 INSERT INTO fts_orders (docid, content)  SELECT orders.id AS docid, COALESCE(orders.[id], '') || ' ' || COALESCE(orders.[order_date], '') || ' ' || COALESCE(orders.[customer_id], '') || ' ' || COALESCE(orders.[total_amount], '') || ' ' || COALESCE(orders.[mod_by], '') || ' ' || COALESCE(orders.[mod_on], '') || ' ' || COALESCE(orders.[add_by], '') || ' ' || COALESCE(orders.[add_on], '') || ' ' || COALESCE(orders.[own_by], '') || ' ' || COALESCE(vra_orders.ref, '') || ' ' || COALESCE(vra_customers01.ref, '') as content FROM orders, vra_orders, vra_customers AS vra_customers01 WHERE orders.id = new.id AND vra_orders.id = orders.id AND vra_customers01.id = orders.[customer_id];
END;

CREATE TRIGGER tgr_orders_bu  BEFORE UPDATE ON orders BEGIN
 DELETE FROM fts_orders WHERE docid = old.id;
END;

CREATE TRIGGER tgr_orders_au AFTER UPDATE ON orders BEGIN
 INSERT INTO fts_orders (docid, content)  SELECT orders.id AS docid, COALESCE(orders.[id], '') || ' ' || COALESCE(orders.[order_date], '') || ' ' || COALESCE(orders.[customer_id], '') || ' ' || COALESCE(orders.[total_amount], '') || ' ' || COALESCE(orders.[mod_by], '') || ' ' || COALESCE(orders.[mod_on], '') || ' ' || COALESCE(orders.[add_by], '') || ' ' || COALESCE(orders.[add_on], '') || ' ' || COALESCE(orders.[own_by], '') || ' ' || COALESCE(vra_orders.ref, '') || ' ' || COALESCE(vra_customers01.ref, '') as content FROM orders, vra_orders, vra_customers AS vra_customers01 WHERE orders.id = new.id AND vra_orders.id = orders.id AND vra_customers01.id = orders.[customer_id];
END;

CREATE TRIGGER tgr_orders_bd  BEFORE DELETE ON orders BEGIN
 DELETE FROM fts_orders WHERE docid = old.id;
END;


CREATE VIRTUAL TABLE fts_products_in_orders USING fts4(content, tokenize=simple "tokenchars=-");

CREATE TRIGGER tgr_products_in_orders_ai AFTER INSERT ON products_in_orders BEGIN
 INSERT INTO fts_products_in_orders (docid, content)  SELECT products_in_orders.id AS docid, COALESCE(products_in_orders.[id], '') || ' ' || COALESCE(products_in_orders.[order_id], '') || ' ' || COALESCE(products_in_orders.[product_id], '') || ' ' || COALESCE(products_in_orders.[unit_price], '') || ' ' || COALESCE(products_in_orders.[quantity], '') || ' ' || COALESCE(products_in_orders.[mod_by], '') || ' ' || COALESCE(products_in_orders.[mod_on], '') || ' ' || COALESCE(products_in_orders.[add_by], '') || ' ' || COALESCE(products_in_orders.[add_on], '') || ' ' || COALESCE(products_in_orders.[own_by], '') || ' ' || COALESCE(vra_products_in_orders.ref, '') || ' ' || COALESCE(vra_orders01.ref, '') || ' ' || COALESCE(vra_products01.ref, '') as content FROM products_in_orders, vra_products_in_orders, vra_orders AS vra_orders01, vra_products AS vra_products01 WHERE products_in_orders.id = new.id AND vra_products_in_orders.id = products_in_orders.id AND vra_orders01.id = products_in_orders.[order_id] AND vra_products01.id = products_in_orders.[product_id];
END;

CREATE TRIGGER tgr_products_in_orders_bu  BEFORE UPDATE ON products_in_orders BEGIN
 DELETE FROM fts_products_in_orders WHERE docid = old.id;
END;

CREATE TRIGGER tgr_products_in_orders_au AFTER UPDATE ON products_in_orders BEGIN
 INSERT INTO fts_products_in_orders (docid, content)  SELECT products_in_orders.id AS docid, COALESCE(products_in_orders.[id], '') || ' ' || COALESCE(products_in_orders.[order_id], '') || ' ' || COALESCE(products_in_orders.[product_id], '') || ' ' || COALESCE(products_in_orders.[unit_price], '') || ' ' || COALESCE(products_in_orders.[quantity], '') || ' ' || COALESCE(products_in_orders.[mod_by], '') || ' ' || COALESCE(products_in_orders.[mod_on], '') || ' ' || COALESCE(products_in_orders.[add_by], '') || ' ' || COALESCE(products_in_orders.[add_on], '') || ' ' || COALESCE(products_in_orders.[own_by], '') || ' ' || COALESCE(vra_products_in_orders.ref, '') || ' ' || COALESCE(vra_orders01.ref, '') || ' ' || COALESCE(vra_products01.ref, '') as content FROM products_in_orders, vra_products_in_orders, vra_orders AS vra_orders01, vra_products AS vra_products01 WHERE products_in_orders.id = new.id AND vra_products_in_orders.id = products_in_orders.id AND vra_orders01.id = products_in_orders.[order_id] AND vra_products01.id = products_in_orders.[product_id];
END;

CREATE TRIGGER tgr_products_in_orders_bd  BEFORE DELETE ON products_in_orders BEGIN
 DELETE FROM fts_products_in_orders WHERE docid = old.id;
END;



