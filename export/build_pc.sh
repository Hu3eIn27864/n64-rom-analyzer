#!/bin/bash
set -e
echo "Building N64 High-Level C++ Reconstructed Project..."
mkdir -p build
cd build
cmake ..
cmake --build .
echo "Build complete! Running sm64_reconstructed..."
./sm64_reconstructed
