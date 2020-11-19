npm run release
"Compressing Windows Archive"
Compress-Archive -Path ".\dist\win-unpacked" -DestinationPath ".\release\windows\MUVR.zip" -Force
Copy-Item ".\dist\MUVR Native Caster Setup 0.0.1.exe" -Destination ".\release\windows\MUVR Native Caster Setup 0.0.1.exe" -Force
wsl bash build-linux.sh
wsl bash build-macos.sh