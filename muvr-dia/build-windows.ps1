#Set relative path to mingw64 toolchain
$mingw64 = "$PSScriptRoot" + "\mingw-w64\x86_64-8.1.0-win32-seh-rt_v6-rev0\mingw64\bin\"
#Append to path variable that is scoped to only this powershell script. No global pollution
$env:Path += ";$mingw64"
#$env:Path

#Configure Go to use toolcahin for CGO
Set-Variable -Name "GOOS" -Value "windows"
Set-Variable -Name "GOARCH" -Value "amd64"
Set-Variable -Name "CGO_ENABLED" -Value 1
Set-Variable -Name "CC" -Value "x86_64-w64-mingw32-gcc"
Set-Variable -Name "CXX" -Value "x86_64-w64-mingw32-g++"

#Fetch dependencies
go get github.com/go-vgo/robotgo github.com/jgranstrom/gonodepkg github.com/jgranstrom/go-simplejson
#Build
go build -x -o ./win32/muvr-dia.exe muvr-dia.go