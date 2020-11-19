# xporpoise-robot

# Build

SET GOOS=windows
SET GOARCH=amd64
SET CGO_ENABLED=1
SET CC=x86_64-w64-mingw32-gcc
SET CXX=x86_64-w64-mingw32-g++
go get github.com/go-vgo/robotgo github.com/jgranstrom/gonodepkg github.com/jgranstrom/go-simplejson
go build xporpoise-gobot.go