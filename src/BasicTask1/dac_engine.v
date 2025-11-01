module advanced_dds_engine (
    input  wire        clk,           // clk
    input  wire        rst_n,
    
    // config register
    input  wire        enable,
    input  wire [31:0] freq,
    input  wire [15:0] phase_offset,
    input  wire [1:0]  interpolation_mode,
    input  wire        phase_dither_en,
    input  wire        noise_shaping_en,

    // data in bram
    input  wire        wr_en,
    input  wire [8:0]  wr_addr,
    input  wire [15:0] wr_data,
    
    //physics pin
    output reg [15:0]  dout
);

localparam PHASE_WIDTH = 32;
localparam WAVE_POINTS = 512;
localparam INDEX_WIDTH = 9;
localparam DITHER_WIDTH = 8;

// 相位累加器
reg [PHASE_WIDTH-1:0] phase_acc;

// LFSR相位抖动
reg [DITHER_WIDTH-1:0] lfsr_reg;
wire lfsr_feedback = lfsr_reg[7] ^ lfsr_reg[5] ^ lfsr_reg[4] ^ lfsr_reg[3];
wire [DITHER_WIDTH-1:0] dither_noise = phase_dither_en ? lfsr_reg : 8'b0;

// bram初始化为0
(* ram_style = "block" *)
reg [15:0] waveform_bram [0:WAVE_POINTS-1];

integer k;
initial begin
    for (k = 0; k < WAVE_POINTS; k = k + 1) begin
        waveform_bram[k] = 16'b0;
    end
end

// BRAM写入
always @(posedge clk) begin
    if (wr_en) begin
        waveform_bram[wr_addr] <= wr_data;
    end
end

// 相位累加
always @(posedge clk or negedge rst_n) begin
    if (!rst_n) begin
        phase_acc <= 0;
        lfsr_reg <= 8'hFF;
    end else if (enable) begin
        phase_acc <= phase_acc + freq;
        lfsr_reg <= {lfsr_reg[6:0], lfsr_feedback};
    end
end

// 相位输出
wire [PHASE_WIDTH-1:0] phase_out = phase_acc + {phase_offset, 16'b0} + {24'b0, dither_noise};

// BRAM读取序
reg [8:0] read_addr_reg;
reg [15:0] wave_p0, wave_p1, wave_p2;

always @(posedge clk or negedge rst_n) begin
    if (!rst_n) begin
        read_addr_reg <= 0;
        wave_p0 <= 0;
        wave_p1 <= 0;
        wave_p2 <= 0;
    end else if (enable) begin
        // 计算读取地址
        read_addr_reg <= phase_out[PHASE_WIDTH-1:PHASE_WIDTH-INDEX_WIDTH];
        
        // 同步读取BRAM
        wave_p0 <= waveform_bram[read_addr_reg];
        wave_p1 <= waveform_bram[(read_addr_reg + 1) % WAVE_POINTS];
        wave_p2 <= waveform_bram[(read_addr_reg + 2) % WAVE_POINTS];
    end
end

// 插值处理
wire [15:0] linear_output;
wire [15:0] cubic_output;

// 线性插值
linear_interp u_linear (
    .clk(clk),
    .rst_n(rst_n),
    .enable(enable),
    .p0(wave_p0),
    .p1(wave_p1),
    .frac(phase_out[PHASE_WIDTH-INDEX_WIDTH-1:PHASE_WIDTH-INDEX_WIDTH-4]),
    .out(linear_output)
);

// 立方插值  
cubic_interp u_cubic (
    .clk(clk),
    .rst_n(rst_n),
    .enable(enable),
    .p0(wave_p0),
    .p1(wave_p1),
    .p2(wave_p2),
    .frac(phase_out[PHASE_WIDTH-INDEX_WIDTH-1:PHASE_WIDTH-INDEX_WIDTH-8]),
    .out(cubic_output)
);

// 插值模式选择
reg [15:0] interpolated_output;
always @(posedge clk or negedge rst_n) begin
    if (!rst_n) begin
        interpolated_output <= 0;
    end else if (enable) begin
        case(interpolation_mode)
            2'b00: interpolated_output <= wave_p0;     // 无插值
            2'b01: interpolated_output <= linear_output; // 线性插值
            2'b10: interpolated_output <= cubic_output;  // 立方插值
            default: interpolated_output <= wave_p0;
        endcase
    end
end

// 噪声整形
reg [15:0] error_accum;
reg [15:0] shaped_output;

always @(posedge clk or negedge rst_n) begin
    if (!rst_n) begin
        error_accum <= 16'b0;
        shaped_output <= 16'b0;
    end else if (enable) begin
        if (noise_shaping_en) begin
            shaped_output <= interpolated_output + error_accum;
            error_accum <= interpolated_output - shaped_output;
        end else begin
            shaped_output <= interpolated_output;
            error_accum <= 16'b0;
        end
    end
end

// 最终输出
always @(posedge clk or negedge rst_n) begin
    if (!rst_n) begin
        dout <= 16'b0;
    end else if (enable) begin
        dout <= shaped_output;
    end
end

endmodule

// 线性插值模块
module linear_interp(
    input  wire        clk,
    input  wire        rst_n,
    input  wire        enable,
    input  wire [15:0] p0,
    input  wire [15:0] p1,
    input  wire [3:0]  frac,
    output reg  [15:0] out
);

reg signed [16:0] sp0, sp1;
reg [3:0] frac_reg;
reg signed [16:0] diff;
reg signed [20:0] scaled_diff;

always @(posedge clk or negedge rst_n) begin
    if (!rst_n) begin
        sp0 <= 0;
        sp1 <= 0;
        frac_reg <= 0;
        diff <= 0;
        scaled_diff <= 0;
        out <= 0;
    end else if (enable) begin
        // 阶段1: 转换和锁存
        sp0 <= {p0[15], p0};
        sp1 <= {p1[15], p1};
        frac_reg <= frac;
        
        // 阶段2: 计算差值
        diff <= sp1 - sp0;
        
        // 阶段3: 乘法和最终计算
        scaled_diff <= diff * $signed({1'b0, frac_reg});
        out <= sp0 + (scaled_diff >>> 4);
    end
end

endmodule

// 立方插值模块
module cubic_interp (
    input  wire        clk,
    input  wire        rst_n,
    input  wire        enable,
    input  wire [15:0] p0,
    input  wire [15:0] p1,
    input  wire [15:0] p2,
    input  wire [7:0]  frac,
    output reg  [15:0] out
);

reg signed [16:0] sp0, sp1, sp2;
reg [7:0] frac_reg;
reg signed [16:0] c0, c1, c2, c3;
reg signed [15:0] t;
reg signed [23:0] t2;
reg signed [31:0] t3;
reg signed [31:0] result;

always @(posedge clk or negedge rst_n) begin
    if (!rst_n) begin
        sp0 <= 0; sp1 <= 0; sp2 <= 0;
        frac_reg <= 0;
        c0 <= 0; c1 <= 0; c2 <= 0; c3 <= 0;
        t <= 0; t2 <= 0; t3 <= 0;
        result <= 0;
        out <= 0;
    end else if (enable) begin
        // 阶段1: 转换和锁存
        sp0 <= {p0[15], p0};
        sp1 <= {p1[15], p1};
        sp2 <= {p2[15], p2};
        frac_reg <= frac;
        
        // 阶段2: 系数计算
        c0 <= sp1;
        c1 <= (sp2 - sp0) >>> 1;
        c2 <= sp0 - (sp1 << 1) + sp2;
        c3 <= (sp0 - sp1) >>> 1 + (sp1 - sp2);
        
        // 阶段3: 多项式项计算
        t <= {8'b0, frac_reg};
        t2 <= t * t;
        t3 <= t2 * t;
        
        // 阶段4: 最终计算
        result <= c0 + ((c1 * t) >>> 8) + ((c2 * t2) >>> 16) + ((c3 * t3) >>> 24);
        out <= result[15:0];
    end
end

endmodule

// top module
module dac_engine (
    input  wire        clk,          
    input  wire        rst_n,
    
    // config register
    input  wire        dds_enable,
    input  wire [31:0] frequency,
    input  wire [15:0] amplitude,
    input  wire [15:0] phase_offset,
    input  wire        high_quality_mode,

    // data for bram
    input  wire        wave_wr_en,
    input  wire [8:0]  wave_addr,
    input  wire [15:0] wave_data,
    
    
    
    output wire [15:0] dac_out
);

wire [15:0] dds_out;

advanced_dds_engine u_dds (
    .clk(clk),
    .rst_n(rst_n),
    .enable(dds_enable),
    .freq(frequency),
    .phase_offset(phase_offset),
    .wr_en(wave_wr_en),
    .wr_addr(wave_addr),
    .wr_data(wave_data),
    .interpolation_mode(high_quality_mode ? 2'b10 : 2'b01),
    .phase_dither_en(high_quality_mode),
    .noise_shaping_en(high_quality_mode),
    .dout(dds_out)
);

// amplitude
reg [15:0] dds_out_reg;
reg signed [31:0] scaled_reg;

always @(posedge clk or negedge rst_n) begin
    if (!rst_n) begin
        dds_out_reg <= 16'b0;
        scaled_reg <= 32'b0;
    end else begin
        dds_out_reg <= dds_out;
        scaled_reg <= $signed(dds_out_reg) * $signed({1'b0, amplitude});
    end
end

assign dac_out = scaled_reg[30:15];

endmodule