#!/bin/bash
ssh -t -i /home/remy/.ssh/id_latitude_rsa remy@latitude 'cd xporpoise-robot && chmod +x ./buildscripts/build-linux.sh && ./buildscripts/build-linux.sh'
scp -i /home/remy/.ssh/id_latitude_rsa remy@latitude:/home/remy/xporpoise-robot/linux/xporpoise-gobot ./linux/xporpoise-gobot