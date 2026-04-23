@echo off
setlocal enabledelayedexpansion
set "filepath=%~1"
python "%~dp0publier-article.py" "%filepath%"
