/* Reconstructed Fast3D / F3DEX2 Display List */
void render_reconstructed_display_list(Gfx** gfx) {
    gSPVertex(gfx++, 0x8025e000, 193, 12);
    gSP1Triangle(gfx++, 2, 1, 0, 0);
    gSPDisplayList(gfx++, 0x8028f120);
    gDPSetOtherMode(gfx++, 0xdf000000, 0x0);
}