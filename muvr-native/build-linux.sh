#!/bin/bash
ssh -t -i /home/remy/.ssh/id_latitude_rsa remy@latitude 'cd muvr-native && chmod +x ./buildscripts/build-linux.sh && ./buildscripts/build-linux.sh'
scp -i /home/remy/.ssh/id_latitude_rsa remy@latitude:"/home/remy/muvr-native/dist/MUVR_0.0.1_amd64.snap" "./release/linux/MUVR_0.0.1_amd64.snap"
scp -i /home/remy/.ssh/id_latitude_rsa remy@latitude:"/home/remy/muvr-native/dist/MUVR Native Caster-0.0.1.AppImage" "./release/linux/MUVR Native Caster-0.0.1.AppImage"