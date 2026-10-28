@echo off
rem Copia todos os dados do banco do computador para o banco do Render.
chcp 65001 >nul
cd /d "%~dp0.."
"C:\Users\Blade\.tools\node-v24.19.0-win-x64\node.exe" scripts\migrar-para-render.js
