# MUVR.xyz
[![MUVR Logo](https://muvr.xyz/featured-background.jpg)](https://muvr.xyz)
[Homepage](https://muvr.xyz) | [Video Demo](https://www.youtube.com/watch?v=pFoa-2wwGos) | [Try it out!](https://muvr.xyz/app/caster/)

<a href="https://www.buymeacoffee.com/muvr" target="_blank"><img src="https://www.buymeacoffee.com/assets/img/custom_images/orange_img.png" alt="Buy Me A Coffee" style="height: 41px !important;width: 174px !important;box-shadow: 0px 3px 2px 0px rgba(190, 190, 190, 0.5) !important;-webkit-box-shadow: 0px 3px 2px 0px rgba(190, 190, 190, 0.5) !important;" ></a>


---

## MUVR.xyz is a virtual reality platform designed to:

  - Lower the monetary and skill barriers necessary to participate in the Virtual Reality (VR) community
  - Provide a unified, operating system agnostic, performant platform for VR
  - Make **ANY** Game or Desktop Application VR capable with no access to source code
  - - Without needing to run the numbers at all, *this makes MUVR.xyz the largest VR gaming platform by a long shot.*
  - Be as wireless as possible (Support 5G, 4G, Bluetooth, Wifi connectivity out of the box)
  - - Use VR in the comfort of your home over WiFi or anywhere in the world on a 5G enabled mobile device



## W x 5

  - Who: *remy*
  - - - *@muvr.xyz* (feel free to shoot me an e-mail, follow me on [Twitter](https://twitter.com/_mattata))
  - What: A highly extendable Peer-To-Peer (P2P) VR platform
  - When: Began development late July 2019
  - Why:  I had the brief opportunity to play with an Oculus Quest and was extremely impressed. At the time, I was saving for a down payment on a house and the $400 price tag seemed an irresponsible expenditure. After a weekend of tinkering and continuially reading "the future of VR is only 5 years out!", it occurred to me that there was a good chance the future of VR would likely be developed by someone who is currently in their 'teens' and this techonology is woefully inaccessible to them in the current day. MUVR.xyz is an attempt to bridge that gap so that a unified VR platform can be used on existing hardware such as a $20 Android phone in the same way the platform is used on a $400 Oculus Quest.
  - Why (contd.): I was also rather bitter I couldn't play the 1999 Unreal Engine based [Nerf Arena Blast](https://en.wikipedia.org/wiki/Nerf_Arena_Blast) in VR. It's Nerf or Nothing.
 
 ## Constraints and Possbilities
To support the broadest range of devices most development and testing was performed using low-end devices with a goal of at least 30FPS at VGA Resolution (640x480) with a maximum of 100ms round trip latency at any given time. Any modern (past 5 years) devices should significantly outperform these requirements.

**Caster**

Windows 10: 4th Gen Intel® Core i5 Processor, with Intel HD Graphics 4400 with 8 GB RAM (Dual-channel LPDDR3)

Linux (aarch64): Quad-core ARM® A57, with 128-core NVIDIA Maxwell™ architecture-based GPU with 4 GB 64-bit LPDDR4 RAM

MacOS: Virtualbox VM with 2 vCPU's and 128MB Graphics Memory

**Client**

Apple: iPhone 6

Android: Moto G7 Play (Scores in the bottom 11% of all devices as measured by 3DMark Slingshot Extreme)

---

## How It Works

 MUVR.xyz consists of 4 main components
 
 - *muvr-server* (The deployable site)
 - - *muvr-hugo*
 - *muvr-native* (A stripped down Electron application that exists as a wrapper so that *muvr-server* can be accessed and interact with *muvr-dia* on a users desktop)
 - *muvr-dia* (The Desktop Input Application. Allows a press of the "X" button on a gamepad paired to a mobile phone to be translated to pressing the "Spacebar" on the desktop)
 
Additional Terms:
- **Caster**: The desktop application providing video output and consuming desktop input
- - This can be any modern web browser if desktop input is destined for something like an HTML5 game. It can also be the *muvr-native* desktop application to allow interaction with any desktop application (Games, Other Web Browsers, Excel, MS Paint, etc...)
- **Client**: The web-app that provides desktop input and consumes video input
 > The Client is entirely browser based and designed to work on any mobile device with no requirement of downloading any "apps".

### High Level Diagram
[![MUVR Diagram](https://muvr.xyz/readme-assets/images/MUVR.png)](https://muvr.xyz)
 
#### Typical User Flow
 - A user begins **casting** by visiting https://muvr.xyz/app/caster/ on their computer using any web browser or *muvr-native* , configures their settings, and clicks "START CASTING"
 - The user is prompted to select the screen, window, or application from which they wish to cast video
 - A [socket.io](https://socket.io/) WebSockets room is provisioned and a scannable QR pairing code is generated
 - The user scans the QR code which contains the link to the web-app **client** along with pairing key
 - The user selects their viewing mode (Stereoscopic/Mono) and presses "CONNECT"
 - WebRTC ICE candidates are exchanged between the **caster** and **client** through the room until a Peer-To-Peer (P2P) connection is established
 - Upon successfull P2P connection, the WebSocket connection is dropped and all further interaction is fully P2P.
 - The user sees video from the **caster** and the **client** sends Desktop Input (Gyroscope, Gamepad, plick...)

Watch this short video (4 minutes) of configuring an iPhone 6 to draw in Microsoft Paint.

[![MUVR.xyz Pairing Example](http://img.youtube.com/vi/pFoa-2wwGos/0.jpg)](http://www.youtube.com/watch?v=pFoa-2wwGos "MUVR.xyz Pairing Example")

#### Client Tips

**Android**: Works out of the box with every Gamepad I've tried.

**iOS**: You will need to download and configure a "Gamepad Testing" App in order for mobile Safari to recognize gamepad input. A quick search in the app store will find you what you need.
 
**Gamepad**: 

The Playstation DS4 controller supports bluetooth pairing  for both Android and iOS by pessing and holding the "Home" and "Share" buttons. These are high qaulity controllers that can be purchased used for a couple of dollars.

---

### Installation

MUVR.xyz does not require any installation unless you need the Desktop Input provided by *muvr-native*.
If you'd like to just take a peek, simply click [MUVR.xyz/app/caster](https://muvr.xyz/app/caster/) to get started.

*muvr-native* builds can be found for each OS platform on the [Releases page](https://github.com/xen0bit/muvr.xyz/releases).

### Development

Want to contribute? Great!

MUVR.xyz requires the following dependencies be installed prior to beginning development work:

All Operating Systems:
 * [Node.js v12+](https://nodejs.org/en/download/)
 * [Go v1.14+](https://golang.org/dl/)
 * [Hugo **Extended** v0.76.0+](https://github.com/gohugoio/hugo/releases)
 * * *It must be the "extended" version*

**Windows:**

None. A compatiable mingw64-w64 toolchain is included with *muvr-dia* for windows.

**Ubuntu:**
```sh
$ apt install gcc libc6-dev libx11-dev xorg-dev libxtst-dev libpng++-dev xcb libxcb-xkb-dev x11-xkb-utils libx11-xcb-dev libxkbcommon-x11-dev libxkbcommon-dev xsel xclip
```

**MacOS**

You will be automatically prompted to install "Command Line Tools for XCode" upon your first build.

### Development Installation
Open your favorite Terminal and clone the repo
```sh
$ git clone https://github.com/xen0bit/muvr.xyz.git
$ cd muvr.xyz
$ npm run installer
```

#### Building from source
Run the command that matches your development Operating System
```sh
$ npm run build-windows
$ npm run build-linux
$ npm run build-macos
```

Video of Full installation and Build  via [asciinema.org](https://asciinema.org/)
[![Ubuntu Install and Build](https://muvr.xyz/readme-assets/images/asciinema.jpg)](https://asciinema.org/a/uafMcKzdssTk9Ea46dPOc9OaS)

### Running the code
Each folder contains a package.json definition that has useful scripts to individually step through each process of the compilation.

Example: To run *muvr-server* without recompiling the assets:
```sh
cd muvr-server
npm run start-nojscomp
```
```sh
> node ./bin/www
Listening on port 8080
```

For required features of MUVR.xyz **the site must be served over HTTPS**.
Tools that provide local HTTPS for Development work
* [ngrok](https://ngrok.com/) - secure introspectable tunnels to localhost
* [Autossh](https://medium.com/@_mattata/making-localhost-available-on-the-public-internet-without-port-forwarding-914f3a4785cc) - Forwarding traffic from a public IP to localhost



#### HAProxy and PM2
The [MUVR.xyz](https://muvr.xyz) site runs on [HAProxy](http://www.haproxy.org/) which allows for load balancing and forced injection of HTTP Security Headers.
Because of it's P2P nature, MUVR.xyz server does not incur any resource burn once a P2P connection has been established allowing me to make the following claim:
* Max Concurrent Active Pairing Sessions: **4 Million**
* Max P2P Established Users: **Infinite**

An example HAProxy config can be found in the *muvr-server* folder named haproxy.cfg

The backend server is managed by [PM2](https://pm2.keymetrics.io/) and the server can be daemonized using:
```sh
$ npm install pm2 -g
$ pm2 start ecosystem.config.js
```

In the event that there is enough active pairing sessions where CPU becomes the bottleneck, more backend servers can be added to scale horizonally by reserving a new backend port with no additional configuration.

```sh
$ pm2 scale muvr-server 4
```

This will result in 4 new instances listening on ports 8080-->8083 which are healthchecked by HAProxy and automatically brought online.


### Todos

 - Take a break and do some self care after ~1300 hours of development
 - Persistent Gamepad --> Desktop Input Mappings
 - Oculus Controller support
 - WebXR Integration

License
----
All modules and their relevant licenses are properly tagged and are compiled with proper license tagging.
If the file is not tagged, the following license applies.

Copyright (C) 2019-2020 Matthew Remacle
* remy
* * @muvr.xyz

This file is part of MUVR.xyz.
MUVR.xyz can not be copied and/or distributed for use without the express permission of Matthew Remacle.

---

If you are an individual seeking express permission for *non-commerical use*:
 - The answer is almost certainly a resounding "Yes"

If you are interested in obtaining permission for *commerical use in an ethical manner*, please contact me.



   
   
