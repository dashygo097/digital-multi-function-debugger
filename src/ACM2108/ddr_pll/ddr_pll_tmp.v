//Copyright (C)2014-2025 Gowin Semiconductor Corporation.
//All rights reserved.
//File Title: Template file for instantiation
//Part Number: GW5A-LV25UG324C2/I1
//Device: GW5A-25
//Device Version: A


//Change the instance name and port connections to the signal names
//--------Copy here to design--------
    ddr_pll your_instance_name(
        .clkin(clkin), //input  clkin
        .clkout0(clkout0), //output  clkout0
        .clkout2(clkout2), //output  clkout2
        .lock(lock), //output  lock
        .mdopc(mdopc), //input [1:0] mdopc
        .mdainc(mdainc), //input  mdainc
        .mdwdi(mdwdi), //input [7:0] mdwdi
        .mdrdo(mdrdo), //output [7:0] mdrdo
        .pll_init_bypass(pll_init_bypass), //input  pll_init_bypass
        .mdclk(mdclk), //input  mdclk
        .reset(reset) //input  reset
);


//--------Copy end-------------------
