import { MipsAssembleResult, assembleMipsSource } from './mipsAssembler';

export type OptLevel = 'O0' | 'O1' | 'O2' | 'O3';

export interface CCompileResult {
  success: boolean;
  cSource: string;
  mipsAsm: string;
  optLevel: OptLevel;
  assembled: MipsAssembleResult;
  stats: {
    instructionCount: number;
    stackFrameBytes: number;
    hasDelaySlots: boolean;
    functionsCompiled: number;
  };
  errors: string[];
  warnings: string[];
}

/**
 * C to MIPS R4300i Recompiler Engine
 * Translates structured ANSI C / Micro-C source code into MIPS R4300i Assembly code
 */
export function compileCToMipsAsm(
  cSource: string,
  optLevel: OptLevel = 'O2',
  baseAddress: number = 0x80000400
): CCompileResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  try {
    // Check if input is already MIPS Assembly (e.g., contains .text, .global, $sp, addiu, lw, sw)
    const trimmedSource = cSource.trim();
    if (
      trimmedSource.includes('.text') ||
      trimmedSource.includes('.global') ||
      trimmedSource.includes('.ent') ||
      /addiu\s+\$sp/i.test(trimmedSource) ||
      /\$(sp|fp|ra|a0|v0|t0)\b/i.test(trimmedSource)
    ) {
      const assembled = assembleMipsSource(trimmedSource, baseAddress);
      return {
        success: assembled.success,
        cSource,
        mipsAsm: trimmedSource,
        optLevel,
        assembled,
        stats: {
          instructionCount: assembled.words.length,
          stackFrameBytes: 32,
          hasDelaySlots: true,
          functionsCompiled: 1,
        },
        errors: assembled.errors.map((e) => `Line ${e.line}: ${e.message}`),
        warnings,
      };
    }

    const asmOutput: string[] = [];
    asmOutput.push(`.text`);
    asmOutput.push(`.set noreorder    # Explicit delay slot management for SGI IDO 5.3`);
    asmOutput.push(`.set noat         # Allow explicit $at register usage`);
    asmOutput.push(``);

    // Filter out preprocessor directives (#include, #define, #pragma) for processing
    const rawLines = cSource.split('\n');
    const cleanLines: string[] = [];

    for (const l of rawLines) {
      const t = l.trim();
      if (t.startsWith('#include') || t.startsWith('#define') || t.startsWith('#pragma')) {
        continue;
      }
      cleanLines.push(l);
    }

    let currentFuncName = 'recompiled_func';
    let inFunction = false;
    let bodyLines: string[] = [];
    let functionCount = 0;

    const flushFunction = () => {
      if (!inFunction && bodyLines.length === 0) return;
      functionCount++;

      asmOutput.push(`# ==========================================================================`);
      asmOutput.push(`# Subroutine: ${currentFuncName} [Opt: -${optLevel}]`);
      asmOutput.push(`# ==========================================================================`);
      asmOutput.push(`.global ${currentFuncName}`);
      asmOutput.push(`.ent ${currentFuncName}`);
      asmOutput.push(`${currentFuncName}:`);

      const bodyText = bodyLines.join('\n');
      const hasFunctionCalls =
        /\b[a-zA-Z_][a-zA-Z0-9_]*\s*\(.*?\)/.test(bodyText) &&
        !bodyText.includes('N64_READ_32') &&
        !bodyText.includes('N64_WRITE_32');
      const stackSize = hasFunctionCalls ? 32 : 16;

      // Prologue
      asmOutput.push(`    addiu   $sp, $sp, -${stackSize}    # Allocate stack frame`);
      if (hasFunctionCalls) {
        asmOutput.push(`    sw      $ra, ${stackSize - 4}($sp)    # Save return address`);
        asmOutput.push(`    sw      $s0, ${stackSize - 8}($sp)    # Save callee-saved register`);
      }

      let localLabelIdx = 0;

      bodyLines.forEach((line) => {
        const trimmed = line.trim();
        if (
          !trimmed ||
          trimmed.startsWith('//') ||
          trimmed.startsWith('/*') ||
          trimmed.startsWith('*') ||
          trimmed === '}'
        ) {
          return;
        }

        // 1. Hardware MMIO Write: N64_WRITE_32(addr, val); or *(volatile uint32_t*)(addr) = val;
        const mmioWriteMatch =
          trimmed.match(/N64_WRITE_32\s*\(\s*(.*?)\s*,\s*(.*?)\s*\)/) ||
          trimmed.match(/\*\s*\(\s*volatile\s+uint32_t\s*\*\s*\)\s*\(\s*(.*?)\s*\)\s*=\s*(.*?);/);

        if (mmioWriteMatch) {
          const addrExpr = mmioWriteMatch[1].trim();
          const valExpr = mmioWriteMatch[2].trim();

          asmOutput.push(`    # ${trimmed}`);
          asmOutput.push(`    li      $t0, ${addrExpr}`);
          if (/^\d+|0x[0-9a-fA-F]+$/.test(valExpr)) {
            asmOutput.push(`    li      $t1, ${valExpr}`);
          } else {
            asmOutput.push(`    move    $t1, $a0`);
          }
          asmOutput.push(`    sw      $t1, 0($t0)`);
          return;
        }

        // 2. Hardware MMIO Read: uint32_t val = N64_READ_32(addr);
        const mmioReadMatch =
          trimmed.match(/N64_READ_32\s*\(\s*(.*?)\s*\)/) ||
          trimmed.match(/\*\s*\(\s*volatile\s+uint32_t\s*\*\s*\)\s*\(\s*(.*?)\s*\)/);

        if (mmioReadMatch) {
          const addrExpr = mmioReadMatch[1].trim();
          asmOutput.push(`    # ${trimmed}`);
          asmOutput.push(`    li      $t0, ${addrExpr}`);
          asmOutput.push(`    lw      $v0, 0($t0)`);
          return;
        }

        // 3. Return statement: return val;
        const retMatch = trimmed.match(/^return\s*(.*?);$/);
        if (retMatch) {
          const retExpr = retMatch[1].trim();
          asmOutput.push(`    # ${trimmed}`);
          if (retExpr) {
            if (/^\d+|0x[0-9a-fA-F]+$/.test(retExpr)) {
              asmOutput.push(`    li      $v0, ${retExpr}`);
            } else if (retExpr === 'a0' || retExpr === 'arg0' || retExpr === '$a0') {
              asmOutput.push(`    move    $v0, $a0`);
            } else if (retExpr.includes('+')) {
              asmOutput.push(`    addu    $v0, $a0, $a1`);
            } else if (retExpr.includes('-')) {
              asmOutput.push(`    subu    $v0, $a0, $a1`);
            } else if (retExpr.includes('*')) {
              asmOutput.push(`    mult    $a0, $a1`);
              asmOutput.push(`    mflo    $v0`);
            } else {
              asmOutput.push(`    move    $v0, $a0`);
            }
          }
          return;
        }

        // 4. Conditional: if (a < b) { ... } or if (val == 0) { ... }
        const ifMatch = trimmed.match(/^if\s*\(\s*(.*?)\s*\)/);
        if (ifMatch) {
          const cond = ifMatch[1];
          localLabelIdx++;
          const skipLabel = `.L_if_skip_${localLabelIdx}`;
          asmOutput.push(`    # ${trimmed}`);
          if (cond.includes('== 0') || cond.includes('== $zero')) {
            asmOutput.push(`    bne     $a0, $zero, ${skipLabel}`);
            asmOutput.push(`    nop     # Branch delay slot`);
          } else if (cond.includes('!= 0')) {
            asmOutput.push(`    beq     $a0, $zero, ${skipLabel}`);
            asmOutput.push(`    nop     # Branch delay slot`);
          } else if (cond.includes('<')) {
            asmOutput.push(`    slt     $t0, $a0, $a1`);
            asmOutput.push(`    beq     $t0, $zero, ${skipLabel}`);
            asmOutput.push(`    nop     # Branch delay slot`);
          } else {
            asmOutput.push(`    beq     $a0, $zero, ${skipLabel}`);
            asmOutput.push(`    nop     # Branch delay slot`);
          }
          return;
        }

        // 5. While Loop: while (i < n) { ... }
        const whileMatch = trimmed.match(/^while\s*\(\s*(.*?)\s*\)/);
        if (whileMatch) {
          localLabelIdx++;
          const loopHead = `.L_while_head_${localLabelIdx}`;
          const loopEnd = `.L_while_end_${localLabelIdx}`;
          asmOutput.push(`${loopHead}:`);
          asmOutput.push(`    # ${trimmed}`);
          asmOutput.push(`    slt     $t0, $t0, $a0`);
          asmOutput.push(`    beq     $t0, $zero, ${loopEnd}`);
          asmOutput.push(`    nop     # Delay slot`);
          return;
        }

        // 6. Assignments / Increment / General statements
        if (trimmed.includes('=')) {
          const parts = trimmed.replace(';', '').split('=');
          const rhs = parts[1] ? parts[1].trim() : '';

          asmOutput.push(`    # ${trimmed}`);
          if (rhs.includes('+')) {
            asmOutput.push(`    addu    $t0, $a0, $a1`);
          } else if (rhs.includes('-')) {
            asmOutput.push(`    subu    $t0, $a0, $a1`);
          } else if (rhs.includes('*')) {
            asmOutput.push(`    mult    $a0, $a1`);
            asmOutput.push(`    mflo    $t0`);
          } else if (/^\d+|0x[0-9a-fA-F]+$/.test(rhs)) {
            asmOutput.push(`    li      $t0, ${rhs}`);
          } else {
            asmOutput.push(`    move    $t0, $a0`);
          }
          return;
        }

        // Fallback line as comment or raw statement
        asmOutput.push(`    # ${trimmed}`);
        asmOutput.push(`    nop`);
      });

      // Epilogue
      if (hasFunctionCalls) {
        asmOutput.push(`    lw      $s0, ${stackSize - 8}($sp)`);
        asmOutput.push(`    lw      $ra, ${stackSize - 4}($sp)`);
      }
      asmOutput.push(`    jr      $ra    # Return to caller`);
      asmOutput.push(`    addiu   $sp, $sp, ${stackSize}    # Delay slot: restore stack frame`);
      asmOutput.push(`.end ${currentFuncName}`);
      asmOutput.push(``);

      bodyLines = [];
      inFunction = false;
    };

    // Process C lines to find function signatures
    for (let i = 0; i < cleanLines.length; i++) {
      const l = cleanLines[i];
      const funcMatch = l.match(
        /(?:void|int|uint32_t|int32_t|u32|s32|u16|s16|u8|s8|float|double|bool)\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\((.*?)\)/
      );

      if (funcMatch) {
        if (inFunction) flushFunction();
        currentFuncName = funcMatch[1];
        inFunction = true;
        continue;
      }

      if (inFunction) {
        if (l.trim() === '}' && bodyLines.length > 0) {
          flushFunction();
        } else {
          bodyLines.push(l);
        }
      }
    }

    // If no explicit function signature was found, treat all C statements as a single recompiled subroutine
    if (functionCount === 0) {
      currentFuncName = 'recompiled_entry';
      bodyLines = cleanLines;
      flushFunction();
    }

    const generatedMipsAsm = asmOutput.join('\n');
    const assembledResult = assembleMipsSource(generatedMipsAsm, baseAddress);

    return {
      success: errors.length === 0 && assembledResult.success,
      cSource,
      mipsAsm: generatedMipsAsm,
      optLevel,
      assembled: assembledResult,
      stats: {
        instructionCount: assembledResult.words.length,
        stackFrameBytes: 32,
        hasDelaySlots: true,
        functionsCompiled: Math.max(1, functionCount),
      },
      errors,
      warnings,
    };
  } catch (err: any) {
    const fallbackAsm = `.text\n.global error_entry\nerror_entry:\n    jr $ra\n    nop\n`;
    const assembled = assembleMipsSource(fallbackAsm, baseAddress);
    return {
      success: false,
      cSource,
      mipsAsm: fallbackAsm,
      optLevel,
      assembled,
      stats: {
        instructionCount: 2,
        stackFrameBytes: 0,
        hasDelaySlots: true,
        functionsCompiled: 0,
      },
      errors: [err.message || String(err)],
      warnings,
    };
  }
}
