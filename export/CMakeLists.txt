cmake_minimum_required(VERSION 3.20)
project(SUPER_MARIO_64_Decomp CXX C)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_C_STANDARD 11)

# Include directories
include_directories(
    ${CMAKE_CURRENT_SOURCE_DIR}/include
    ${CMAKE_CURRENT_SOURCE_DIR}/include/engine
    ${CMAKE_CURRENT_SOURCE_DIR}/include/hardware
)

# Source files
set(SOURCES
    src/main.cpp
    src/hardware/n64_hardware.cpp
    src/engine/recompiled_code.cpp
    src/engine/n64_highlevel_c.c
    src/engine/n64_modern_cpp.cpp
    src/rendering/rsp_display_lists.cpp
)

set(HEADERS
    include/types.h
    include/engine/n64_types.h
    include/engine/recompiled_code.hpp
    include/hardware/n64_hardware.hpp
    include/hardware/sm64_decomp.h
)

add_executable(sm64_reconstructed ${SOURCES} ${HEADERS})

if(MSVC)
    target_compile_options(sm64_reconstructed PRIVATE /W4 /O2 /std:c++20)
else()
    target_compile_options(sm64_reconstructed PRIVATE -Wall -O3 -std=c++20)
endif()
