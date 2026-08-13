@echo off
echo =========================================================
echo  C++ TO MIPS R4300i REASSEMBLY SCRIPT (Windows CMD)
echo  Title: SUPER MARIO 64 [ID: NSME]
echo =========================================================
echo.

set CPP_SRC=src\engine\n64_modern_cpp.cpp
set ASM_OUT=asm\n64_cpp_mips_reassembled.asm

if not "%~1"=="" set CPP_SRC=%~1
if not "%~2"=="" set ASM_OUT=%~2

echo [Step 1] Running Python C++ to MIPS Reassembler Engine...
python scripts\reassemble_cpp_to_mips.py "%CPP_SRC%" "%ASM_OUT%"

if %ERRORLEVEL% EQU 0 (
    echo.
    echo [SUCCESS] Generated MIPS Assembly: %ASM_OUT%
) else (
    echo.
    echo [ERROR] C++ to MIPS reassembly failed.
)

pause
