@echo off
set GIT_CMD="C:\Users\laxmi\AppData\Local\Programs\Git\cmd\git.exe"
set REPO_URL=https://github.com/laxminarayandash640/PunchApp.git

if not "%~1"=="" (
    set REPO_URL=%1
)

echo =======================================================
echo Pushing Employee Attendance Web App to GitHub:
echo %REPO_URL%
echo =======================================================
echo.

%GIT_CMD% remote remove origin 2>nul
%GIT_CMD% remote add origin %REPO_URL%
%GIT_CMD% branch -M main

echo Uploading to GitHub...
%GIT_CMD% push -u origin main

if %ERRORLEVEL% EQU 0 (
    echo.
    echo =======================================================
    echo SUCCESS: Project successfully pushed to:
    echo %REPO_URL%
    echo =======================================================
) else (
    echo.
    echo =======================================================
    echo ERROR: Push failed. If prompted, please complete
    echo the GitHub login dialog in your browser.
    echo =======================================================
)

pause
