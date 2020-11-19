#!/bin/bash
ssh -t -i /home/remy/.ssh/id_mbp_rsa remy@remys-mbp 'cd Documents/GitHub/xporpoise-robot && chmod +x ./buildscripts/build-macos.sh && ./buildscripts/build-macos.sh'
scp -i /home/remy/.ssh/id_mbp_rsa remy@remys-mbp:Documents/GitHub/xporpoise-robot/macos/xporpoise-gobot ./macos/xporpoise-gobot
