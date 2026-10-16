@echo off
if exist "%~dp0release\TRWriting-2.2.0-x64-portable.exe" (
  start "" "%~dp0release\TRWriting-2.2.0-x64-portable.exe"
  exit /b
)
if exist "%~dp0release\win-unpacked\TRWriting.exe" (
  start "" "%~dp0release\win-unpacked\TRWriting.exe"
  exit /b
)
start "" "%~dp0index.html"
