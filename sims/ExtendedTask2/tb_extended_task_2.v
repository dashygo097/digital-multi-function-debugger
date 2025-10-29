`timescale 1ns/1ps
module tb_bitseq_looper_top_v2;

    //===============================
    // 0) 时钟/复位：50MHz
    //===============================
    reg clk = 0;
    always #10 clk = ~clk;  // 20ns -> 50MHz

    reg rst_n = 0;
    initial begin
        rst_n = 0;
        #200;
        rst_n = 1;
    end

    //===============================
    // 1) 参数
    //===============================
    localparam integer NCH = 4;              // 通道数
    localparam integer AW  = 4;              // 每通道深度=16
    localparam integer CHW = (NCH<=1)?1:$clog2(NCH);
    localparam integer RATE_DIV_1M = 49;     // 1MHz 位速（50MHz/(49+1)）

    //===============================
    // 2) DUT 端口信号
    //===============================
    reg  [NCH-1:0] start_ch_bus;   // 每通道启动脉冲
    reg  [NCH-1:0] stop_ch_bus;    // 每通道停止脉冲
    reg            sync_enable;    // 同步模式开关
    reg  [NCH-1:0] arm_mask_in;    // 同步模式：武装位图
    reg            arm_load;       // 装载武装位图（1拍）
    reg            group_start;    // 群启（1拍）

    reg  [NCH*(AW+1)-1:0] len_bus;       // 打包长度
    reg  [NCH*32-1:0]     rate_div_bus;  // 打包分频
    reg  [NCH*32-1:0]     phase_off_bus; // 打包相位

    reg                   wr_en;
    reg  [CHW-1:0]        wr_ch;
    reg  [AW-1:0]         wr_addr;
    reg                   wr_bit;

    wire [NCH-1:0]        io_out;
    wire [NCH-1:0]        playing;

    // 友好别名（满足“io1, io2 ...”的显示）
    wire io1 = io_out[0];
    wire io2 = io_out[1];
    wire io3 = io_out[2];
    wire io4 = io_out[3];

    //===============================
    // 3) 例化 DUT
    //===============================
    bitseq_looper_top_v2 #(
        .NCH(NCH),
        .AW (AW)
    ) dut (
        .clk          (clk),
        .rst_n        (rst_n),
        .start_ch_bus (start_ch_bus),
        .stop_ch_bus  (stop_ch_bus),
        .sync_enable  (sync_enable),
        .arm_mask_in  (arm_mask_in),
        .arm_load     (arm_load),
        .group_start  (group_start),
        .len_bus      (len_bus),
        .rate_div_bus (rate_div_bus),
        .phase_off_bus(phase_off_bus),
        .wr_en        (wr_en),
        .wr_ch        (wr_ch),
        .wr_addr      (wr_addr),
        .wr_bit       (wr_bit),
        .io_out       (io_out),
        .playing      (playing)
    );

    //===============================
    // 4) VCD
    //===============================
    initial begin
        $dumpfile("tb_new_scenarios.vcd");
        $dumpvars(0, tb_bitseq_looper_top_v2);
    end

    //===============================
    // 5) 工具任务（Verilog-2001 版）
    //===============================
    task pulse_start; input integer ch; begin
        @(posedge clk); start_ch_bus[ch] = 1'b1;
        @(posedge clk); start_ch_bus[ch] = 1'b0;
    end endtask

    task pulse_stop; input integer ch; begin
        @(posedge clk); stop_ch_bus[ch] = 1'b1;
        @(posedge clk); stop_ch_bus[ch] = 1'b0;
    end endtask

    task pulse_arm_load; begin
        @(posedge clk); arm_load = 1'b1;
        @(posedge clk); arm_load = 1'b0;
    end endtask

    task pulse_group_start; begin
        @(posedge clk); group_start = 1'b1;
        @(posedge clk); group_start = 1'b0;
    end endtask

    // 写序列比特（仅未播放时）
    task wr_bit_to_channel;
        input integer ch;
        input [AW-1:0] addr;
        input data;
        begin
            @(posedge clk);
            wr_en   = 1'b1;
            wr_ch   = ch[CHW-1:0];
            wr_addr = addr;
            wr_bit  = data;
            @(posedge clk);
            wr_en   = 1'b0;
        end
    endtask

    //===============================
    // 6) 配置与打包
    //===============================
    integer i;
    reg [AW:0]  len_ch   [0:NCH-1];
    reg [31:0]  rate_ch  [0:NCH-1];
    reg [31:0]  phase_ch [0:NCH-1];

    task pack_buses; integer k; begin
        len_bus       = '0;
        rate_div_bus  = '0;
        phase_off_bus = '0;
        for (k=0;k<NCH;k=k+1) begin
            len_bus      [(k*(AW+1)) +: (AW+1)] = len_ch[k];
            rate_div_bus [(k*32)     +: 32]     = rate_ch[k];
            phase_off_bus[(k*32)     +: 32]     = phase_ch[k];
        end
    end endtask

    //===============================
    // 7) 激励流程
    //===============================
    initial begin
        // 初值
        start_ch_bus  = {NCH{1'b0}};
        stop_ch_bus   = {NCH{1'b0}};
        sync_enable   = 1'b0;
        arm_mask_in   = {NCH{1'b0}};
        arm_load      = 1'b0;
        group_start   = 1'b0;
        len_bus       = '0; rate_div_bus='0; phase_off_bus='0;
        wr_en         = 1'b0; wr_ch='0; wr_addr='0; wr_bit=1'b0;

        // 等复位
        @(posedge rst_n);
        @(posedge clk);

        //========================================================
        // 场景 1：单通道启动（ch0），随后上位机驱动 ch1，之后停止
        //   ch0 序列：1010101010（长度=10）
        //   ch1 序列：0101010101（长度=10）
        //========================================================
        // 配置：两路相同速率/相位
        for (i=0;i<NCH;i=i+1) begin
            len_ch[i]   = 10;            // 长度=10
            rate_ch[i]  = RATE_DIV_1M;   // 1MHz
            phase_ch[i] = 32'd0;         // 无延时
        end
        pack_buses();

        // 写 ch0: 1010101010
        for (i=0;i<10;i=i+1) wr_bit_to_channel(0, i[AW-1:0], (i[0]?1'b0:1'b1));
        // 写 ch1: 0101010101
        for (i=0;i<10;i=i+1) wr_bit_to_channel(1, i[AW-1:0], (i[0]?1'b1:1'b0));

        // 启动 ch0
        sync_enable = 1'b0;          // 独立启动模式
        pulse_start(0);
        // 运行若干位周期（例如 50 个位周期 ≈ 50us）
        repeat (50*(RATE_DIV_1M+1)) @(posedge clk);

        // “上位机”脉冲到来，启动 ch1
        pulse_start(1);
        // 再跑一会儿
        repeat (30*(RATE_DIV_1M+1)) @(posedge clk);

        // 停止输出（两路均停）
        pulse_stop(0);
        pulse_stop(1);
        repeat (5*(RATE_DIV_1M+1)) @(posedge clk);

        //========================================================
        // 场景 2：多通道同步启动
        //   统一长度（示例：8），四通道同时启动
        //========================================================
        // 重新装载：长度=8，速率=1MHz，phase=0
        for (i=0;i<NCH;i=i+1) begin
            len_ch[i]   = 8;
            rate_ch[i]  = RATE_DIV_1M;
            phase_ch[i] = 32'd0;
        end
        pack_buses();

        // 给每路写一段 8 位示例序列（你可按需替换）
        // ch0: 01010101
        for (i=0;i<8;i=i+1) wr_bit_to_channel(0, i[AW-1:0], (i[0]?1'b1:1'b0));
        // ch1: 10101010
        for (i=0;i<8;i=i+1) wr_bit_to_channel(1, i[AW-1:0], (i[0]?1'b0:1'b1));
        // ch2: 00001111
        for (i=0;i<4;i=i+1) wr_bit_to_channel(2, i[AW-1:0], 1'b0);
        for (i=4;i<8;i=i+1) wr_bit_to_channel(2, i[AW-1:0], 1'b1);
        // ch3: 11110000
        for (i=0;i<4;i=i+1) wr_bit_to_channel(3, i[AW-1:0], 1'b1);
        for (i=4;i<8;i=i+1) wr_bit_to_channel(3, i[AW-1:0], 1'b0);

        // 同步启动：武装四通道 → 群启
        sync_enable = 1'b1;
        arm_mask_in = {NCH{1'b1}};   // 4 路都武装
        pulse_arm_load();             // 装载
        // 可以选择隔几拍，也可以同拍直接群启
        repeat (3) @(posedge clk);
        pulse_group_start();          // 同时启动 4 路
        // 运行一段时间
        repeat (80*(RATE_DIV_1M+1)) @(posedge clk);

        $display("[%0t] TB done.", $time);
        $finish;
    end

endmodule
