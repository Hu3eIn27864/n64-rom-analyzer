#!/bin/bash
# Reassemble High-Level C++20 / C Source Code into MIPS R4300i Assembly (.asm)
set -e

echo "========================================================="
echo " C++ TO MIPS R4300i REASSEMBLY SCRIPT (Linux / macOS)"
echo " Title: SUPER MARIO 64 [ID: NSME]"
echo "========================================================="
echo ""

CPP_SRC="src/engine/n64_modern_cpp.cpp"
ASM_OUT="asm/n64_cpp_mips_reassembled.asm"

if [ -f "$1" ]; then
    CPP_SRC="$1"
fi
if [ -n "$2" ]; then
    ASM_OUT="$2"
fi

echo "[Step 1] Running Python C++ -> MIPS Reassembler Engine..."
python3 scripts/reassemble_cpp_to_mips.py "$CPP_SRC" "$ASM_OUT"

echo ""
echo "[Step 2] Verifying Reassembled MIPS Assembly Output..."
if [ -f "$ASM_OUT" ]; then
    echo "[SUCCESS] Generated MIPS Assembly File: $ASM_OUT"
    head -n 25 "$ASM_OUT"
else
    echo "[ERROR] Failed to generate MIPS assembly file."
    exit 1
fi

echo ""
echo "========================================================="
echo " C++ TO MIPS REASSEMBLY COMPLETED SUCCESSFULLY!"
echo "========================================================="
