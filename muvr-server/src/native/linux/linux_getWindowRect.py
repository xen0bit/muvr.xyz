import Xlib
import Xlib.display
import sys
import json
display = Xlib.display.Display()
screen = display.screen()
root = screen.root
tree = root.query_tree()
wins = tree.children

found_window = False

for win in wins:
    if(win.get_wm_name() == str(sys.argv[1]) and found_window == False):
        geometry = win.get_geometry()._data
        left = geometry['x']
        top = geometry['y']
        bottom = geometry['x'] + geometry['width']
        right = geometry['y'] + geometry['height']
        rect = {"left": left, "top": top, "bottom": bottom, "right": right}
        print(json.dumps(rect))
        found_window = True

if(found_window == False):
    print('None')