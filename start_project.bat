@echo off
REM Start Smart AutoSecure Vision
echo Starting Smart AutoSecure Vision...

REM 1. Activate Virtual Environment (Assuming standard placement if any)
REM If user has venv, they should activate it first, or we assume global python is correct as per their usage

REM 2. Check Public IP (Helpful for Atlas Whitelist)
echo Checking Public IP Address...
python check_public_ip.py

REM 3. Test Atlas Connection
echo Testing Atlas Connection...
python test_atlas_debug.py
if %errorlevel% neq 0 (
    echo.
    echo WARNING: Atlas Connection Failed! 
    echo Please ensure the IP shown above is whitelisted in MongoDB Atlas.
    echo Falling back to Local Mode (functionality preserved).
    timeout /t 5
) else (
    echo Atlas Connected Successfully!
)

REM 4. Setup Atlas DB (User must have set password in .env)
echo Running DB Setup / Migration checks...
python db_setup_atlas.py

REM 5. Start Backend (Flask/Django)
echo Starting Backend Server...
start "Backend Server" python manage.py runserver

REM 6. Start Frontend
echo Starting Frontend...
cd frontend
start "Frontend Server" npm run dev

echo.
echo Project is running!
echo Backend: http://localhost:8000
echo Frontend: http://localhost:5175
echo.
pause

