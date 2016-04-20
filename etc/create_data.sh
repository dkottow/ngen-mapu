# run me from root dir.
export DATA_DIR=etc/data
mocha $DATA_DIR/sales-create-schema.js
sqlite3 sales.sqlite < $DATA_DIR/sales-data.sql

mocha $DATA_DIR/sandwiches-create-schema.js
sqlite3 sandwiches.sqlite < $DATA_DIR/sandwiches-dim-data.sql
mocha $DATA_DIR/sandwiches-generate-data.js

mocha $DATA_DIR/soccer-create-schema.js
sqlite3 soccer.sqlite < $DATA_DIR/soccer-dim-data.sql
mocha $DATA_DIR/soccer-generate-data.js

cp sales.json soccer.json test/
cp sales.sqlite test/
cp sales.sqlite sandwiches.sqlite soccer.sqlite data/demo
