# Golden N64 Fixture

This is a synthetic, deterministic N64 big-endian ROM used exclusively
for analyzer tests.

It is not a commercial ROM and is not intended to be bootable.

## Program

The fixture contains two functions:

- `0x1000` — main
- `0x1040` — add

Logical source:

```c
int main(void) {
    return add(10, 20);
}

int add(int a, int b) {
    return a + b;
}
