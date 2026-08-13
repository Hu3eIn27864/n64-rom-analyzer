@echo off
echo Building N64 High-Level C++ Reconstructed Project...
if not exist build mkdir build
cd build
cmake ..
cmake --build .
echo Build complete!
sm64_reconstructed.exe
cd ..
pause
