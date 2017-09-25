# run me from root dir.
export SRC_DIR=etc/test-data
export TEST_DIR=test/data

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
