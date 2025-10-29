// 同步模式不是指时钟同步，而是一次性让多通道同时启动
module bitseq_looper_top_v2 #(
    parameter NCH = 8,
    parameter AW  = 8
)(
    input  wire                    clk,
    input  wire                    rst_n,

    // 每通道独立“启动/停止”脉冲（clk域，1拍）
    input  wire [NCH-1:0]          start_ch_bus,
    input  wire [NCH-1:0]          stop_ch_bus,

    // 同步启动控制
    input  wire                    sync_enable,   // 0=独立启动；1=准备同步启动
    input  wire [NCH-1:0]          arm_mask_in,  // 选择待一起启动的通道
    input  wire                    arm_load,     // 装载 arm_mask_in
    input  wire                    group_start,  // 群发启动脉冲（1拍）

    // 原始配置总线（上位机随时可写）
    input  wire [NCH*(AW+1)-1:0]   len_bus,
    input  wire [NCH*32-1:0]       rate_div_bus,
    input  wire [NCH*32-1:0]       phase_off_bus,

    // 简易序列写口（未播放时写）
    input  wire                    wr_en,
    input  wire [ (NCH<=1)?1:$clog2(NCH) -1 : 0 ]  wr_ch, // 更健壮的位宽处理
    input  wire [AW-1:0]           wr_addr,
    input  wire                    wr_bit,

    output wire [NCH-1:0]          io_out,
    output wire [NCH-1:0]          playing
);

    reg  [NCH-1:0] arm_mask_reg;
    always @(posedge clk or negedge rst_n) begin
        if (!rst_n) begin
            arm_mask_reg <= {NCH{1'b0}};
        end else begin
            if (arm_load && sync_enable)
                arm_mask_reg <= arm_mask_in;         // 装载当拍生效
            if (group_start && sync_enable)
                arm_mask_reg <= {NCH{1'b0}};         // 启动当拍已输出，清零给下一拍
        end
    end

    wire [NCH-1:0] arm_sum = arm_mask_reg
                           | ({NCH{arm_load & sync_enable}} & arm_mask_in);

    wire [NCH-1:0] start_eff_bus;
    genvar gi;
    generate
        for (gi = 0; gi < NCH; gi = gi + 1) begin : gSTART
            assign start_eff_bus[gi] = (sync_enable == 1'b0)
                                      ? start_ch_bus[gi]
                                      : (group_start & arm_sum[gi]);
        end
    endgenerate

    // 顶层锁存寄存器阵列
    reg [AW:0]  len_lat      [0:NCH-1];
    reg [31:0]  rate_div_lat [0:NCH-1];
    reg [31:0]  phase_off_lat[0:NCH-1];

    // 从打包总线解包当前（原始）配置
    wire [AW:0]  len_i_cur      [0:NCH-1];
    wire [31:0]  rate_div_i_cur [0:NCH-1];
    wire [31:0]  phase_off_i_cur[0:NCH-1];

    generate
        for (gi = 0; gi < NCH; gi = gi + 1) begin : gUNPACK
            assign len_i_cur     [gi] = len_bus      [(gi*(AW+1)) +: (AW+1)];
            assign rate_div_i_cur[gi] = rate_div_bus [(gi*32)     +: 32];
            assign phase_off_i_cur[gi]= phase_off_bus[(gi*32)     +: 32];
        end
    endgenerate

    integer ii;
    always @(posedge clk or negedge rst_n) begin
        if (!rst_n) begin
            for (ii = 0; ii < NCH; ii = ii + 1) begin
                len_lat[ii]       <= {{AW{1'b0}},1'b1}; // 缺省长度=1
                rate_div_lat[ii]  <= 32'd0;
                phase_off_lat[ii] <= 32'd0;
            end
        end else begin
            for (ii = 0; ii < NCH; ii = ii + 1) begin
                if (start_eff_bus[ii] && !playing[ii]) begin
                    len_lat[ii]       <= (len_i_cur[ii] == 0) ? {{AW{1'b0}},1'b1} : len_i_cur[ii];
                    rate_div_lat[ii]  <= rate_div_i_cur[ii];
                    phase_off_lat[ii] <= phase_off_i_cur[ii];
                end
            end
        end
    end

    generate
        for (gi = 0; gi < NCH; gi = gi + 1) begin : gCH
            bitseq_player #(.AW(AW)) u_player (
                .clk       (clk),
                .rst_n     (rst_n),
                .start_trig(start_eff_bus[gi]),
                .stop      (stop_ch_bus[gi]),

                .len       (len_lat[gi]),        // ← 用锁存后的配置
                .rate_div  (rate_div_lat[gi]),
                .phase_off (phase_off_lat[gi]),

                .wr_en     (wr_en && (wr_ch == gi[ ((NCH<=1)?1:$clog2(NCH)) -1 : 0 ])),
                .wr_addr   (wr_addr),
                .wr_bit    (wr_bit),

                .io_out    (io_out[gi]),
                .playing   (playing[gi])
            );
        end
    endgenerate

endmodule
