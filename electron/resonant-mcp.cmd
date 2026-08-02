@echo off
setlocal
set "ELECTRON_RUN_AS_NODE=1"
"%~dp0Resonant.exe" "%~dp0resources\app.asar\mcp-dist\server.mjs" %*
