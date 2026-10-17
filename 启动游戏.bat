@echo off
setlocal EnableExtensions DisableDelayedExpansion
chcp 65001 >nul
title 中国式赌狗
pushd "%~dp0"
if errorlevel 1 goto folder_error
where node.exe >nul 2>&1
if errorlevel 1 goto node_missing
node.exe -e "process.exit(Number(process.versions.node.split('.')[0]) >= 22 ? 0 : 1)"
if errorlevel 1 goto node_old
if not exist "scripts\launch.mjs" goto files_missing
node.exe "scripts\launch.mjs"
set "GAME_EXIT=%ERRORLEVEL%"
if not "%GAME_EXIT%"=="0" goto launch_error
popd
exit /b 0

:node_missing
echo 未找到 Node.js。请先安装 Node.js 22 或更新版本，再双击本文件。
echo 官方下载：https://nodejs.org/
goto failed

:node_old
echo 当前 Node.js 版本过低或无法运行。请安装 Node.js 22 或更新版本。
echo 官方下载：https://nodejs.org/
goto failed

:files_missing
echo 游戏文件不完整。请先解压整个压缩包，再运行启动器。
goto failed

:launch_error
echo 游戏未能启动，请查看上方提示。
goto failed

:folder_error
echo 无法进入游戏文件夹。请先完整解压到可访问的位置。
pause
exit /b 1

:failed
popd
pause
exit /b 1
