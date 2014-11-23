#!/bin/bash
node app/server | node_modules/bunyan/bin/bunyan
#node app/server | node_modules/bunyan/bin/bunyan -o short
