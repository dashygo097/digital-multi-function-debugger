// -----------------------------------------------------
// 8-bit x 256 pulse ROM (10% duty: first 26 -> 0xFF, others 0x00)
// Interface identical to sin_rom_a8d8
// -----------------------------------------------------
module pulse10_rom_a8d8(
    addr,
    clk, 
    q
);  

    parameter DATA_WIDTH=8;
    parameter ADDR_WIDTH=8;

    input clk;
    input [(ADDR_WIDTH-1):0] addr;
    output reg [(DATA_WIDTH-1):0] q;

    // Declare the ROM variable
    reg [DATA_WIDTH-1:0] rom[2**ADDR_WIDTH-1:0];

    initial begin
        // 0..25: 0xFF
        rom[000] = 8'h00; rom[001] = 8'h00; rom[002] = 8'h00; rom[003] = 8'h00;
        rom[004] = 8'h00; rom[005] = 8'h00; rom[006] = 8'h00; rom[007] = 8'h00;
        rom[008] = 8'h00; rom[009] = 8'h00; rom[010] = 8'h00; rom[011] = 8'h00;
        rom[012] = 8'h00; rom[013] = 8'h00; rom[014] = 8'h00; rom[015] = 8'h00;
        rom[016] = 8'h00; rom[017] = 8'h00; rom[018] = 8'h00; rom[019] = 8'h00;
        rom[020] = 8'h00; rom[021] = 8'h00; rom[022] = 8'h00; rom[023] = 8'h00;
        rom[024] = 8'h00; rom[025] = 8'h00;

        // 26..255: 0xFF
        rom[026] = 8'hff; rom[027] = 8'hff; rom[028] = 8'hff; rom[029] = 8'hff;
        rom[030] = 8'hff; rom[031] = 8'hff; rom[032] = 8'hff; rom[033] = 8'hff;
        rom[034] = 8'hff; rom[035] = 8'hff; rom[036] = 8'hff; rom[037] = 8'hff;
        rom[038] = 8'hff; rom[039] = 8'hff; rom[040] = 8'hff; rom[041] = 8'hff;
        rom[042] = 8'hff; rom[043] = 8'hff; rom[044] = 8'hff; rom[045] = 8'hff;
        rom[046] = 8'hff; rom[047] = 8'hff; rom[048] = 8'hff; rom[049] = 8'hff;
        rom[050] = 8'hff; rom[051] = 8'hff; rom[052] = 8'hff; rom[053] = 8'hff;
        rom[054] = 8'hff; rom[055] = 8'hff; rom[056] = 8'hff; rom[057] = 8'hff;
        rom[058] = 8'hff; rom[059] = 8'hff; rom[060] = 8'hff; rom[061] = 8'hff;
        rom[062] = 8'hff; rom[063] = 8'hff; rom[064] = 8'hff; rom[065] = 8'hff;
        rom[066] = 8'hff; rom[067] = 8'hff; rom[068] = 8'hff; rom[069] = 8'hff;
        rom[070] = 8'hff; rom[071] = 8'hff; rom[072] = 8'hff; rom[073] = 8'hff;
        rom[074] = 8'hff; rom[075] = 8'hff; rom[076] = 8'hff; rom[077] = 8'hff;
        rom[078] = 8'hff; rom[079] = 8'hff; rom[080] = 8'hff; rom[081] = 8'hff;
        rom[082] = 8'hff; rom[083] = 8'hff; rom[084] = 8'hff; rom[085] = 8'hff;
        rom[086] = 8'hff; rom[087] = 8'hff; rom[088] = 8'hff; rom[089] = 8'hff;
        rom[090] = 8'hff; rom[091] = 8'hff; rom[092] = 8'hff; rom[093] = 8'hff;
        rom[094] = 8'hff; rom[095] = 8'hff; rom[096] = 8'hff; rom[097] = 8'hff;
        rom[098] = 8'hff; rom[099] = 8'hff; rom[100] = 8'hff; rom[101] = 8'hff;
        rom[102] = 8'hff; rom[103] = 8'hff; rom[104] = 8'hff; rom[105] = 8'hff;
        rom[106] = 8'hff; rom[107] = 8'hff; rom[108] = 8'hff; rom[109] = 8'hff;
        rom[110] = 8'hff; rom[111] = 8'hff; rom[112] = 8'hff; rom[113] = 8'hff;
        rom[114] = 8'hff; rom[115] = 8'hff; rom[116] = 8'hff; rom[117] = 8'hff;
        rom[118] = 8'hff; rom[119] = 8'hff; rom[120] = 8'hff; rom[121] = 8'hff;
        rom[122] = 8'hff; rom[123] = 8'hff; rom[124] = 8'hff; rom[125] = 8'hff;
        rom[126] = 8'hff; rom[127] = 8'hff; rom[128] = 8'hff; rom[129] = 8'hff;
        rom[130] = 8'hff; rom[131] = 8'hff; rom[132] = 8'hff; rom[133] = 8'hff;
        rom[134] = 8'hff; rom[135] = 8'hff; rom[136] = 8'hff; rom[137] = 8'hff;
        rom[138] = 8'hff; rom[139] = 8'hff; rom[140] = 8'hff; rom[141] = 8'hff;
        rom[142] = 8'hff; rom[143] = 8'hff; rom[144] = 8'hff; rom[145] = 8'hff;
        rom[146] = 8'hff; rom[147] = 8'hff; rom[148] = 8'hff; rom[149] = 8'hff;
        rom[150] = 8'hff; rom[151] = 8'hff; rom[152] = 8'hff; rom[153] = 8'hff;
        rom[154] = 8'hff; rom[155] = 8'hff; rom[156] = 8'hff; rom[157] = 8'hff;
        rom[158] = 8'hff; rom[159] = 8'hff; rom[160] = 8'hff; rom[161] = 8'hff;
        rom[162] = 8'hff; rom[163] = 8'hff; rom[164] = 8'hff; rom[165] = 8'hff;
        rom[166] = 8'hff; rom[167] = 8'hff; rom[168] = 8'hff; rom[169] = 8'hff;
        rom[170] = 8'hff; rom[171] = 8'hff; rom[172] = 8'hff; rom[173] = 8'hff;
        rom[174] = 8'hff; rom[175] = 8'hff; rom[176] = 8'hff; rom[177] = 8'hff;
        rom[178] = 8'hff; rom[179] = 8'hff; rom[180] = 8'hff; rom[181] = 8'hff;
        rom[182] = 8'hff; rom[183] = 8'hff; rom[184] = 8'hff; rom[185] = 8'hff;
        rom[186] = 8'hff; rom[187] = 8'hff; rom[188] = 8'hff; rom[189] = 8'hff;
        rom[190] = 8'hff; rom[191] = 8'hff; rom[192] = 8'hff; rom[193] = 8'hff;
        rom[194] = 8'hff; rom[195] = 8'hff; rom[196] = 8'hff; rom[197] = 8'hff;
        rom[198] = 8'hff; rom[199] = 8'hff; rom[200] = 8'hff; rom[201] = 8'hff;
        rom[202] = 8'hff; rom[203] = 8'hff; rom[204] = 8'hff; rom[205] = 8'hff;
        rom[206] = 8'hff; rom[207] = 8'hff; rom[208] = 8'hff; rom[209] = 8'hff;
        rom[210] = 8'hff; rom[211] = 8'hff; rom[212] = 8'hff; rom[213] = 8'hff;
        rom[214] = 8'hff; rom[215] = 8'hff; rom[216] = 8'hff; rom[217] = 8'hff;
        rom[218] = 8'hff; rom[219] = 8'hff; rom[220] = 8'hff; rom[221] = 8'hff;
        rom[222] = 8'hff; rom[223] = 8'hff; rom[224] = 8'hff; rom[225] = 8'hff;
        rom[226] = 8'hff; rom[227] = 8'hff; rom[228] = 8'hff; rom[229] = 8'hff;
        rom[230] = 8'hff; rom[231] = 8'hff; rom[232] = 8'hff; rom[233] = 8'hff;
        rom[234] = 8'hff; rom[235] = 8'hff; rom[236] = 8'hff; rom[237] = 8'hff;
        rom[238] = 8'hff; rom[239] = 8'hff; rom[240] = 8'hff; rom[241] = 8'hff;
        rom[242] = 8'hff; rom[243] = 8'hff; rom[244] = 8'hff; rom[245] = 8'hff;
        rom[246] = 8'hff; rom[247] = 8'hff; rom[248] = 8'hff; rom[249] = 8'hff;
        rom[250] = 8'hff; rom[251] = 8'hff; rom[252] = 8'hff; rom[253] = 8'hff;
        rom[254] = 8'hff; rom[255] = 8'hff;
    end

    always @ (posedge clk)
    begin
        q <= rom[addr];
    end

endmodule
