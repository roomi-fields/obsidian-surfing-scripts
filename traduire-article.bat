@echo off
setlocal enabledelayedexpansion
set "filepath=%~1"
node "%~dp0traduire-article.js" "%filepath%"
