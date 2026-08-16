import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const fixtureDir = resolve(root, "tests/fixtures/golden");
const generator = resolve(fixtureDir, "generate.ts");
const romPath = resolve(fixtureDir, "golden-n64.z64");
const expectedPath = resolve(fixtureDir, "expected.json");

const expectedWords = [
  0x27bdffe0, 0xafbf001c, 0x2404000a, 0x24050014,
  0x0c000410, 0x00000000, 0x8fbf001c, 0x27bd0020,
  0x03e00008, 0x00000000, 0x00851021, 0x03e00008,
  0x00000000,
];

test("golden N64 fixture is deterministic and structurally valid", () => {
  rmSync(romPath, { force: true });

  try {
    execFileSync(process.execPath, ["--import", "tsx", generator], {
      cwd: root,
      stdio: "pipe",
    });

    const rom = readFileSync(romPath);
    assert.equal(rom.length, 0x2000);
    assert.equal(rom.readUInt32BE(0x00), 0x80371240);
    assert.equal(rom.readUInt32BE(0x0c), 0x1000);

    expectedWords.forEach((word, index) => {
      assert.equal(
        rom.readUInt32BE(0x1000 + index * 4),
        word >>> 0,
        `unexpected word at 0x${(0x1000 + index * 4).toString(16)}`,
      );
    });

    const expected = JSON.parse(readFileSync(expectedPath, "utf8"));
    assert.equal(expected.rom.format, "n64-z64");
    assert.equal(expected.rom.size, rom.length);
    assert.equal(expected.rom.entryPoint, "0x1000");
    assert.equal(expected.functions.length, 2);
    assert.equal(expected.functions[0].calls[0], "0x1040");
    assert.equal(expected.semantics.operation, "a0 + a1");
    assert.equal(expected.expectedResult, 30);
  } finally {
    rmSync(romPath, { force: true });
  }
});
