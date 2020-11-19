---
title: "Native Caster Alpha Release (v0.0.1)"
date: 2020-09-07T14:18:38-04:00
draft: false
---

Today I release the Alpha (0.0.1) version of the MUVR Native Caster
# Downloads
* Windows (x64)
    * [MUVR Native Caster 0.0.1.zip](https://muvr.xyz/app/downloads/Windows/MUVR%20Native%20Caster%200.0.1.zip "MUVR Native Caster 0.0.1.zip")
    * [MUVR Native Caster Setup 0.0.1.exe](https://muvr.xyz/app/downloads/Windows/MUVR%20Native%20Caster%20Setup%200.0.1.exe "MUVR Native Caster Setup 0.0.1.exe")
* Linux (x64)
    * [MUVR Native Caster-0.0.1.AppImage](https://muvr.xyz/app/downloads/Linux/MUVR%20Native%20Caster-0.0.1.AppImage "MUVR Native Caster-0.0.1.AppImage")
    * [MUVR_0.0.1_amd64.snap](https://muvr.xyz/app/downloads/Linux/MUVR_0.0.1_amd64.snap "MUVR_0.0.1_amd64.snap")
* MacOS (x64)
    * [MUVR Native Caster-0.0.1-mac.zip](https://muvr.xyz/app/downloads/MacOS/MUVR%20Native%20Caster-0.0.1-mac.zip "MUVR Native Caster-0.0.1-mac.zip")
    * [MUVR Native Caster-0.0.1.dmg](https://muvr.xyz/app/downloads/MacOS/MUVR%20Native%20Caster-0.0.1.dmg "MUVR Native Caster-0.0.1.dmg")

# Features
 - Control Mouse using Gyroscope on your mopbile device
 - Control Mouse using Left Analog Stick of a gamepad paired to your mobile device
 - Control Mouse scrolling using Right Analog Stick of a gamepad paired to your mobile device
 - Map Gamepad buttons to keyboard keys or left/right/middle click
 - Gyroscope controls automatically scope to the active casting window and window boundaries are set accordingly

# Known Bugs
 - Desktops running multiple screens will encounter incorrect mouse coordinates
     - This will be fixed in a future release. For now, only a single screen is supported.
 - Security Settings interfering
     - Windows
         - Windows Firewall will prompt to set a new rule to allow P2P communication. This will be included in setup in a future release.
     - MacOS
         - System Preferences will prompt to allow Screen Sharing
         - System Preferences will prompt to allow Destop Interaction
         - Both must be allowed and the application restarted.
 - Video Stream shows blank
     - The main causes of this are:
         - Caster or Client behind a double NAT'd network.
         - Selected stream resolution did not fall back correctly or is an unsupported resolution for the selected window
 - Mouse stays locked to one side of the screen
     - Try facing North, South, East and West. For an unknown reason the point of reference when the client connects is sometimes altered.

# Report Additional Bugs

If you find additional bugs or want to provide feedback, please open and issue on https://github.com/xen0bit/muvr.xyz/issues