var Go = require('./lib/gonode.js').Go;
var events = require('events');
var eventEmitter = new events.EventEmitter();
const path = require('path');
var os = require('os');
//Global Go
var go;

function getGoBinPath() {
    var platform = os.platform();
    if (platform === 'win32') {
        //console.log(path.join(__dirname, 'win32/xporpoise-gobot.exe').replace('app.asar', 'app.asar.unpacked'));
        return path.join(__dirname, 'win32/xporpoise-gobot.exe').replace('app.asar', 'app.asar.unpacked');
    }
    if (platform === 'linux') {
        return path.join(__dirname, 'linux/xporpoise-gobot').replace('app.asar', 'app.asar.unpacked')
    }
    if (platform === 'darwin') {
        return path.join(__dirname, 'macos/xporpoise-gobot').replace('app.asar', 'app.asar.unpacked')
    }
}

exports.xgobotOptions = {
    path: getGoBinPath(),
    initAtOnce: false,
    //Set 2 for "synchonous", higher for async
    maxCommandsRunning: 2,
    defaultCommandTimeoutSec: 1
}

//Go response debug hook
function debugGo(result, response) {
    //This flag is only for developer mode. It will Log every Go IPC call to the console
    //ONLY Use for debugging individual go binaries calls
    //NEVER
    //NEVER
    //NEVER leave this on when testing a full stack. It will cause the eventemitter stack to fill
    //Your mouse/keyboard will slow to a crawl, perfoming functions you did several seconds ago
    //Only a full reboot shakes it loose. Not even killing the go binary will help, the calls are already in win32 api by that point.
    //Generally speaking, never even consider setting this to true.
    var developerMode = false;
    if (developerMode) {
        if (result.ok) {
            console.log('Go responded: ' + JSON.stringify(response));
        }
    }
}

function areWeAwake(callback) {
    go.execute({
        commandText: 'AreWeAwake'

    }, function (result, response) {
        if (result.ok) {
            callback(response.value);
        }
    });
}

function closeGo() {
    go.close();
}
//Mouse
/*
SetMouseDelay
MoveMouse
MoveMouseSmooth
MouseClick
MoveClick
MouseToggle
DragMouse
GetMousePos
ScrollMouse
*/

function SetMouseDelay(ms) {
    go.execute({
        commandText: 'SetMouseDelay',
        ms: ms

    }, debugGo);
}

function MoveMouse(x, y) {
    go.execute({
        commandText: 'MoveMouse',
        x: x,
        y: y

    }, debugGo);
}

function MoveMouseSmooth(x, y, lowSpeed, highSpeed) {
    go.execute({
        commandText: 'MoveMouseSmooth',
        x: x,
        y: y,
        lowSpeed: lowSpeed,
        highSpeed: highSpeed

    }, debugGo);
}

function MouseClick(button, double) {
    go.execute({
        commandText: 'MouseClick',
        button: button,
        double: double

    }, debugGo);
}

function MoveClick(x, y, button, double) {
    go.execute({
        commandText: 'MoveClick',
        x: x,
        y: y,
        button: button,
        double: double

    }, debugGo);
}

function MouseToggle(down, button) {
    go.execute({
        commandText: 'MouseToggle',
        down: down,
        button: button

    }, debugGo);
}

function DragMouse(x, y) {
    go.execute({
        commandText: 'DragMouse',
        x: x,
        y: y

    }, debugGo);
}

function GetMousePos(callback) {
    go.execute({
        commandText: 'GetMousePos'

    }, function (result, response) {
        if (result.ok) {
            callback(response.x, response.y);
        }
    });
}

function ScrollMouse(magnitude, direction) {
    go.execute({
        commandText: 'ScrollMouse',
        magnitude: magnitude,
        direction: direction

    }, debugGo);
}

/*
Keys:
    "A-Z a-z 0-9"

    "backspace"
    "delete"
    "enter"
    "tab"
    "esc"
    "escape"
    "up"		Up arrow key
    "down"		Down arrow key
    "right"		Right arrow key
    "left"		Left arrow key
    "home"
    "end"
    "pageup"
    "pagedown"

    "f1"
    "f2"
    "f3"
    "f4"
    "f5"
    "f6"
    "f7"
    "f8"
    "f9"
    "f10"
    "f11"
    "f12"
    "f13"
    "f14"
    "f15"
    "f16"
    "f17"
    "f18"
    "f19"
    "f20"
    "f21"
    "f22"
    "f23"
    "f24"

    "cmd"		is the "win" key for windows
    "lcmd"		left command
    "rcmd"		right command
    "command"
    "alt"
    "lalt"		left alt
    "ralt"		right alt
    "ctrl"
    "lctrl"		left ctrl
    "rctrl"		right ctrl
    "control"
    "shift"
    "lshift"	left shift
    "rshift"	right shift
    "right_shift"
    "capslock"
    "space"
    "print"
    "printscreen"      // No Mac support
    "insert"
    "menu"				Windows only

    "audio_mute"		Mute the volume
    "audio_vol_down"	Lower the volume
    "audio_vol_up"		Increase the volume
    "audio_play"
    "audio_stop"
    "audio_pause"
    "audio_prev"		Previous Track
    "audio_next"		Next Track
    "audio_rewind"      Linux only
    "audio_forward"     Linux only
    "audio_repeat"      Linux only
    "audio_random"      Linux only


    "num0"
    "num1"
    "num2"
    "num3"
    "num4"
    "num5"
    "num6"
    "num7"
    "num8"
    "num9"
    "num_lock"

    "num."
    "num+"
    "num-"
    "num*"
    "num/"
    "num_clear"
    "num_enter"
    "num_equal"

    // "numpad_0"		No Linux support
    "numpad_0"
    "numpad_1"
    "numpad_2"
    "numpad_3"
    "numpad_4"
    "numpad_5"
    "numpad_6"
    "numpad_7"
    "numpad_8"
    "numpad_9"
    "numpad_lock"

    "lights_mon_up"		 Turn up monitor brightness					No Windows support
    "lights_mon_down"	 Turn down monitor brightness				No Windows support
    "lights_kbd_toggle"	 Toggle keyboard backlight on/off			No Windows support
    "lights_kbd_up"		 Turn up keyboard backlight brightness		No Windows support
    "lights_kbd_down"	 Turn down keyboard backlight brightness	No Windows support
/////////////////////////////////////////////////////////////////////////////////////////////
SetKeyboardDelay (Equivalent to SetKeyDelay, Wno-deprecated)
SetKeyDelay
KeyToggle
//wtf I missed this one?
KeyToggle
TypeString
TypeStringDelayed (Equivalent to TypeStrDelay, Wno-deprecated)
TypeStrDelay
TypeStr
*/

function SetKeyDelay(ms) {
    go.execute({
        commandText: 'SetKeyDelay',
        ms: ms

    }, debugGo);
}

function KeyToggle(key, down, modifer) {
    go.execute({
        commandText: 'KeyToggle',
        key: key,
        down: down,
        modifer: modifer

    }, debugGo);
}

function TypeString(str) {
    go.execute({
        commandText: 'TypeString',
        string: str

    }, debugGo);
}

function TypeStrDelay(str, cpm) {
    go.execute({
        commandText: 'TypeStrDelay',
        string: str,
        cpm: cpm

    }, debugGo);
}

function TypeStr(str) {
    go.execute({
        commandText: 'TypeStr',
        string: str

    }, debugGo);
}

function GetActiveBoundingRect(callback) {
    go.execute({
        commandText: 'GetActiveBoundingRect'

    }, function (result, response) {
        if (result.ok) {
            callback(response.x, response.y, response.w, response.h);
        }
    });
}

function GetScreenSize(callback) {
    go.execute({
        commandText: 'GetScreenSize'

    }, function (result, response) {
        if (result.ok) {
            callback(response.w, response.h);
        }
    });
}

function initEvents() {
    //Wake Up STDIN Pipe
    eventEmitter.addListener('AreWeAwake', areWeAwake);

    //Close Event Trigger
    eventEmitter.addListener('CloseGo', closeGo);

    //Mouse Event Triggers
    eventEmitter.addListener('SetMouseDelay', SetMouseDelay);
    eventEmitter.addListener('MoveMouse', MoveMouse);
    eventEmitter.addListener('MoveMouseSmooth', MoveMouseSmooth);
    eventEmitter.addListener('MouseClick', MouseClick);
    eventEmitter.addListener('MoveClick', MoveClick);
    eventEmitter.addListener('MouseToggle', MouseToggle);
    eventEmitter.addListener('DragMouse', DragMouse);
    eventEmitter.addListener('GetMousePos', GetMousePos);
    eventEmitter.addListener('ScrollMouse', ScrollMouse);

    //Keyboard Event Triggers
    eventEmitter.addListener('SetKeyDelay', SetKeyDelay);
    eventEmitter.addListener('KeyToggle', KeyToggle);
    eventEmitter.addListener('TypeString', TypeString);
    eventEmitter.addListener('TypeStrDelay', TypeStrDelay);
    eventEmitter.addListener('TypeStr', TypeStr);

    //Window Event Triggers
    eventEmitter.addListener('GetActiveBoundingRect', GetActiveBoundingRect);
    eventEmitter.addListener('GetScreenSize', GetScreenSize);
}

//Expose xgotbot module
exports.cmd = (function () {
    return {
        initResolved: undefined,
        init: function () {
            console.log('init');
            return new Promise(function (resolve, reject) {
                go = new Go({
                    path: getGoBinPath(),
                    initAtOnce: false,
                    //Set 2 for "synchonous", higher for async
                    maxCommandsRunning: 2,
                    defaultCommandTimeoutSec: 1
                });
                go.init(function (err) {
                    if (err) throw err;
                    //Handle errors
                    go.on('error', function (err) {
                        if (err.parser) {
                            // Error is coming from internal parser
                            console.log('Parser error: ' + err.data.toString())
                        } else {
                            // External error possible Go panic
                            console.log('Go error: ' + err.data.toString())
                        }
                    });
                    //Attach xgo events
                    initEvents();
                    //Resolve promise that Go is started and ready
                    resolve();
                });
            });
        },
        AreWeAwake: function () {
            eventEmitter.emit('AreWeAwake');
        },
        //
        close: function () {
            eventEmitter.emit('CloseGo');
        },
        //Mouse
        //////////////////////////////////////////////
        SetMouseDelay: function (ms) {
            eventEmitter.emit('SetMouseDelay', ms);
        },
        MoveMouse: function (x, y) {
            eventEmitter.emit('MoveMouse', x, y);
        },
        MoveMouseSmooth: function (x, y, lowSpeed, highSpeed) {
            eventEmitter.emit('MoveMouseSmooth', x, y, lowSpeed, highSpeed);
        },
        MouseClick: function (button, double) {
            eventEmitter.emit('MouseClick', button, double);
        },
        MoveClick: function (x, y, button, double) {
            eventEmitter.emit('MoveClick', x, y, button, double);
        },
        MouseToggle: function (down, button) {
            eventEmitter.emit('MouseToggle', down, button);
        },
        DragMouse: function (x, y) {
            eventEmitter.emit('DragMouse', x, y);
        },
        GetMousePos: function (callback) {
            eventEmitter.emit('GetMousePos', callback);
        },
        ScrollMouse: function (magnitude, direction) {
            eventEmitter.emit('ScrollMouse', magnitude, direction);
        },
        //////////////////////////////////////////////
        //Keyboard
        //////////////////////////////////////////////
        SetKeyDelay: function (ms) {
            eventEmitter.emit('SetKeyDelay', ms);
        },
        KeyToggle: function (key, down, modifer) {
            eventEmitter.emit('KeyToggle', key, down, modifer);
        },
        TypeString: function (str) {
            eventEmitter.emit('TypeString', str);
        },
        TypeStrDelay: function (str, cpm) {
            eventEmitter.emit('TypeStrDelay', str, cpm);
        },
        TypeStr: function (str) {
            eventEmitter.emit('TypeStr', str);
        },
        //////////////////////////////////////////////
        //Window
        //////////////////////////////////////////////
        GetActiveBoundingRect: function (callback) {
            eventEmitter.emit('GetActiveBoundingRect', callback);
        },
        GetScreenSize: function (callback) {
            eventEmitter.emit('GetScreenSize', callback);
        }
    }

})();

//Example
/*
var desktopInput = xgobot.init()
desktopInput.then(function () {
    xgobot.MoveMouse(100, 100);
    go.close();
});
*/

