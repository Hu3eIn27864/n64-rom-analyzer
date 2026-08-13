<#
.SYNOPSIS
  Windows PowerShell script to reassemble C++20 source code into MIPS R4300i Assembly (.asm)
#>
param (
    [string]$CppSource = "src/engine/n64_modern_cpp.cpp",
    [string]$AsmOutput = "asm/n64_cpp_mips_reassembled.asm"
)

Write-Host "=========================================================" -ForegroundColor Cyan
Write-Host " C++ TO MIPS R4300i REASSEMBLY SCRIPT (Windows PowerShell)" -ForegroundColor Cyan
Write-Host " Title: SUPER MARIO 64 [ID: NSME]" -ForegroundColor Yellow
Write-Host "=========================================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "[Step 1] Running Python C++ -> MIPS Reassembler Engine..." -ForegroundColor Green
python scripts/reassemble_cpp_to_mips.py $CppSource $AsmOutput

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "[SUCCESS] Generated MIPS Assembly: $AsmOutput" -ForegroundColor Green
    if (Test-Path $AsmOutput) {
        Get-Content $AsmOutput -Head 20
    }
} else {
    Write-Host ""
    Write-Host "[ERROR] C++ to MIPS reassembly failed." -ForegroundColor Red
}
