set PATH=C:\Program Files\mingw-w64\x86_64-8.1.0-win32-seh-rt_v6-rev0\mingw64\bin;%PATH%
rem echo %PATH%
SET GOOS=windows
SET GOARCH=amd64
SET CGO_ENABLED=1
SET CC=x86_64-w64-mingw32-gcc
SET CXX=x86_64-w64-mingw32-g++
go get github.com/go-vgo/robotgo github.com/jgranstrom/gonodepkg github.com/jgranstrom/go-simplejson
go build -x -o ./win32/muvr-dia.exe muvr-dia.go