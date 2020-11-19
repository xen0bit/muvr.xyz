import pywintypes
from win32 import win32gui
import sys, json


def window_enumeration_handler(hwnd, top_windows):
            """Add window title and ID to array."""
            top_windows.append((hwnd, win32gui.GetWindowText(hwnd)))

top_windows = []
window_name = str(sys.argv[1])

if(window_name == 'DolphinMode'):
    win32gui.EnumWindows(window_enumeration_handler, top_windows)
    found_window = False
    for i in top_windows:
        if('Dolphin' in i[1] and 'FPS' in i[1] and found_window == False):
            rect = win32gui.GetWindowRect(i[0])
            formattedRect = {"left": rect[0], "top": rect[1], "right": rect[2], "bottom": rect[3]}
            print(json.dumps(formattedRect))
            found_window = True

    if(found_window == False):
        print('None')
else:
    win32gui.EnumWindows(window_enumeration_handler, top_windows)
    found_window = False
    for i in top_windows:
        if(i[1] == window_name and found_window == False):
            rect = win32gui.GetWindowRect(i[0])
            formattedRect = {"left": rect[0], "top": rect[1], "right": rect[2], "bottom": rect[3]}
            print(json.dumps(formattedRect))
            found_window = True

    if(found_window == False):
        print('None')