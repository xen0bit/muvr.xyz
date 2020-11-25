package main

import (
	"strconv"

	robotgo "github.com/go-vgo/robotgo"
	json "github.com/jgranstrom/go-simplejson"
	gonode "github.com/jgranstrom/gonodepkg"
)

func main() {
	robotgo.SetMouseDelay(0)
	gonode.Start(process)
}

func process(cmd *json.Json) (response *json.Json) {
	response, m, blankd := json.MakeMap()
	//Still don't know why I have to do this
	_ = blankd

	//Very Simple Check that the STDIN pipe opened successfully

	if cmd.Get("commandText").MustString() == "AreWeAwake" {
		m["responseText"] = "AreWeAwake"
		weAreAwake := true
		m["value"] = weAreAwake
	}

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

	if cmd.Get("commandText").MustString() == "SetMouseDelay" {
		m["responseText"] = "SetMouseDelay"
		ms := cmd.Get("ms").MustInt()
		robotgo.SetMouseDelay(ms)
	}

	if cmd.Get("commandText").MustString() == "MoveMouse" {
		m["responseText"] = "MoveMouse"
		x := cmd.Get("x").MustInt()
		y := cmd.Get("y").MustInt()
		robotgo.MoveMouse(x, y)
	}

	if cmd.Get("commandText").MustString() == "MoveMouseSmooth" {
		m["responseText"] = "MoveMouseSmooth"
		x := cmd.Get("x").MustInt()
		y := cmd.Get("y").MustInt()
		lowSpeed := cmd.Get("lowSpeed").MustFloat64()
		highSpeed := cmd.Get("highSpeed").MustFloat64()
		robotgo.MoveMouseSmooth(x, y, lowSpeed, highSpeed)
	}

	if cmd.Get("commandText").MustString() == "MouseClick" {
		m["responseText"] = "MouseClick"
		button := cmd.Get("button").MustString()
		double := cmd.Get("double").MustString()
		doubleBool, err := strconv.ParseBool(double)
		_ = err
		robotgo.MouseClick(button, doubleBool)
	}

	if cmd.Get("commandText").MustString() == "MoveClick" {
		m["responseText"] = "MoveClick"
		x := cmd.Get("x").MustInt()
		y := cmd.Get("y").MustInt()
		button := cmd.Get("button").MustString()
		double := cmd.Get("double").MustString()
		robotgo.MouseClick(x, y, button, double)
	}

	if cmd.Get("commandText").MustString() == "MouseToggle" {
		m["responseText"] = "MouseToggle"
		down := cmd.Get("down").MustString()
		button := cmd.Get("button").MustString()
		robotgo.MouseToggle(down, button)
	}

	if cmd.Get("commandText").MustString() == "DragMouse" {
		m["responseText"] = "DragMouse"
		x := cmd.Get("x").MustInt()
		y := cmd.Get("y").MustInt()
		robotgo.DragMouse(x, y)
	}

	if cmd.Get("commandText").MustString() == "GetMousePos" {
		m["responseText"] = "GetMousePos"
		x, y := robotgo.GetMousePos()
		m["x"] = x
		m["y"] = y
	}

	if cmd.Get("commandText").MustString() == "ScrollMouse" {
		m["responseText"] = "ScrollMouse"
		magnitude := cmd.Get("magnitude").MustInt()
		direction := cmd.Get("direction").MustString()
		robotgo.ScrollMouse(magnitude, direction)
	}

	/*
		SetKeyboardDelay (Equivalent to SetKeyDelay, Wno-deprecated)
		SetKeyDelay
		KeyTap
		KeyToggle
		TypeString
		TypeStrDelay
		TypeStr
	*/

	if cmd.Get("commandText").MustString() == "SetKeyboardDelay" {
		m["responseText"] = "SetKeyboardDelay"
		ms := cmd.Get("ms").MustInt()
		robotgo.SetKeyboardDelay(ms)
	}

	if cmd.Get("commandText").MustString() == "SetKeyDelay" {
		m["responseText"] = "SetKeyDelay"
		ms := cmd.Get("ms").MustInt()
		robotgo.SetKeyDelay(ms)
	}

	if cmd.Get("commandText").MustString() == "KeyToggle" {
		m["responseText"] = "KeyToggle"
		key := cmd.Get("key").MustString()
		down := cmd.Get("down").MustString()
		//JS is set up, need to configure go to
		//ignore blank values later
		//modifier := cmd.Get("modifier").MustString()
		status := robotgo.KeyToggle(key, down)
		m["status"] = status
	}

	if cmd.Get("commandText").MustString() == "TypeString" {
		m["responseText"] = "TypeString"
		str := cmd.Get("string").MustString()
		robotgo.TypeString(str)
	}

	if cmd.Get("commandText").MustString() == "TypeStrDelay" {
		m["responseText"] = "TypeStrDelay"
		str := cmd.Get("string").MustString()
		cpm := cmd.Get("cpm").MustInt()
		robotgo.TypeStrDelay(str, cpm)
	}

	if cmd.Get("commandText").MustString() == "TypeStr" {
		m["responseText"] = "TypeStr"
		str := cmd.Get("string").MustString()
		robotgo.TypeStr(str)
	}

	//////////////////////////////////////////////////
	//Window
	//////////////////////////////////////////////////
	if cmd.Get("commandText").MustString() == "GetActiveBoundingRect" {
		m["responseText"] = "GetActiveBoundingRect"
		pid := robotgo.GetPID()
		x, y, w, h := robotgo.GetBounds(pid)
		m["x"] = x
		m["y"] = y
		m["w"] = w
		m["h"] = h
	}

	if cmd.Get("commandText").MustString() == "GetScreenSize" {
		m["responseText"] = "GetScreenSize"
		x, y := robotgo.GetScreenSize()
		m["w"] = x
		m["h"] = y
	}

	return
}
