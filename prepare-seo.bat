@echo off
setlocal enabledelayedexpansion
set "filepath=%~1"
node "%~dp0prepare-seo.js" "%filepath%"
