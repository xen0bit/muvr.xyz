#!/bin/bash
export PATH=/home/remy/go/bin:/usr/local/go/bin:/home/remy/go/bin:/usr/local/go/bin:/home/remy/go/bin:/usr/local/go/bin:/home/remy/go/bin:/usr/local/go/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/usr/games:/usr/local/games:/snap/bin
git pull
git reset --hard origin/master
npm run release
