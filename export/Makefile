# Real C++ Project Makefile for SUPER MARIO 64
CXX := g++
CC := gcc
CXXFLAGS := -O3 -std=c++20 -Wall -Iinclude -Iinclude/engine -Iinclude/hardware
CFLAGS := -O2 -std=c11 -Wall -Iinclude -Iinclude/engine -Iinclude/hardware

TARGET := sm64_reconstructed_pc

SRCS_CXX := src/main.cpp src/hardware/n64_hardware.cpp src/engine/recompiled_code.cpp src/engine/n64_modern_cpp.cpp src/rendering/rsp_display_lists.cpp
SRCS_C := src/engine/n64_highlevel_c.c

OBJS := $(SRCS_CXX:.cpp=.o) $(SRCS_C:.c=.o)

.PHONY: all clean run verify pc

all: $(TARGET)

$(TARGET): $(OBJS)
	$(CXX) $(OBJS) -o $@
	@echo "[SUCCESS] Built C++ Executable: $(TARGET)"

%.o: %.cpp
	$(CXX) $(CXXFLAGS) -c $< -o $@

%.o: %.c
	$(CC) $(CFLAGS) -c $< -o $@

pc: $(TARGET)

run: $(TARGET)
	./$(TARGET)

verify:
	python3 recompile_tools.py src/engine/n64_highlevel_c.c asm/n64_disassembly_full.asm

clean:
	rm -rf $(OBJS) $(TARGET) build/ certificates/byte_match_report.json
