#!/bin/bash
ssh -t -i /home/remy/.ssh/id_mbp_rsa remy@remys-mbp 'cd Documents/GitHub/muvr-native && chmod +x ./buildscripts/build-macos.sh && ./buildscripts/build-macos.sh'
scp -i /home/remy/.ssh/id_mbp_rsa remy@remys-mbp:"Documents/GitHub/muvr-native/dist/MUVR Native Caster-0.0.1-mac.zip" "./release/macos/MUVR Native Caster-0.0.1-mac.zip"
scp -i /home/remy/.ssh/id_mbp_rsa remy@remys-mbp:"Documents/GitHub/muvr-native/dist/MUVR Native Caster-0.0.1.dmg" "./release/macos/MUVR Native Caster-0.0.1.dmg"