@echo off
set GIT_CMD="C:\Users\laxmi\AppData\Local\Programs\Git\cmd\git.exe"

if "%~1"=="" (
    echo =======================================================
    echo Push to GitHub Helper
    echo =======================================================
    echo Please provide your GitHub repository URL:
    echo Syntax:  push.bat ^<github-repo-url^>
    echo.
    echo Example: push.bat https://github.com/laxminarayandash20-bit/employee-attendance.git
    echo =======================================================
    exit /b 1
)

echo Adding remote origin: %1
%GIT_CMD% remote remove origin 2>nul
%GIT_CMD% remote add origin %1
%GIT_CMD% branch -M main

echo Pushing main branch to GitHub...
%GIT_CMD% push -u origin main

if %ERRORLEVEL% EQU 0 (
    echo.
    echo =======================================================
    echo SUCCESS: Project pushed to GitHub successfully!
    echo =======================================================
) else (
    echo.
    echo =======================================================
    echo ERROR: Push failed. Check your GitHub repository URL and permissions.
    echo =======================================================
)
