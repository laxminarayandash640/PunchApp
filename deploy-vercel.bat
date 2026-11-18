@echo off
echo ========================================================
echo Deploy Employee Attendance System to Vercel
echo ========================================================
echo.
echo Step 1: Logging in to Vercel (if not already logged in)...
npx --yes vercel login

echo.
echo Step 2: Deploying to Vercel...
npx --yes vercel

echo.
echo ========================================================
echo Deployment initiated!
echo To deploy to Production: run 'npx vercel --prod'
echo ========================================================
pause
