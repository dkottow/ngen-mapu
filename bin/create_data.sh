# run me from root dir.
export SRC_DIR=etc/data
export TEST_DIR=test/data
export DATA_DIR=data

mocha $SRC_DIR/sales-create-schema.js
cp sales.sqlite $TEST_DIR/sqlite/sales_empty.sqlite
sqlite3 sales.sqlite < $SRC_DIR/sales-data.sql

mocha $SRC_DIR/sandwiches-create-schema.js
sqlite3 sandwiches.sqlite < $SRC_DIR/sandwiches-dim-data.sql
mocha $SRC_DIR/sandwiches-generate-data.js

mocha $SRC_DIR/soccer-create-schema.js
sqlite3 soccer.sqlite < $SRC_DIR/soccer-dim-data.sql
mocha $SRC_DIR/soccer-generate-data.js

mocha $SRC_DIR/rentals-create-schema.js

#cp sales.json sandwiches.json soccer.json $TEST_DIR/json
#cp sales.sqlite sandwiches.sqlite soccer.sqlite $TEST_DIR/sqlite
#cp sandwiches.sqlite soccer.sqlite rentals.sqlite $DATA_DIR/demo
#rm sales.json sandwiches.json soccer.json rentals.json
#rm sales.sqlite sandwiches.sqlite soccer.sqlite rentals.sqlite
