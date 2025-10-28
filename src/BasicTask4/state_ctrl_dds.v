module state_ctrl_dds_min(
    input Clk,                  // 主时钟（控制时钟域）
    input Rst_n,
    input [2:0] wave_sel_in,    // 波形选择
    input [31:0] ftw_in,        // 频率控制字
    input dds_apply_pulse,      // 参数应用脉冲
    input clk125m,              // DDS工作时钟（125MHz）

    output [7:0] DA0_Data, 
    output DA0_Clk
);

    // ==================== 主时钟域寄存器 ====================
    // 在主时钟域先寄存输入信号，确保稳定性
    reg [2:0] wave_sel_reg;
    reg [31:0] ftw_reg;
    reg apply_pulse_reg;
    
    always @(posedge Clk or negedge Rst_n) begin
        if (!Rst_n) begin
            wave_sel_reg <= 3'd0;
            ftw_reg <= 32'd0;
            apply_pulse_reg <= 1'b0;
        end else begin
            wave_sel_reg <= wave_sel_in;
            ftw_reg <= ftw_in;
            apply_pulse_reg <= dds_apply_pulse;
        end
    end

    // ==================== 时钟域同步模块 ====================
    
    // 控制信号同步到DDS时钟域
    reg [2:0] wave_sel_sync1, wave_sel_sync2;
    reg [31:0] ftw_sync1, ftw_sync2;
    reg apply_pulse_sync1, apply_pulse_sync2, apply_pulse_sync3;
    
    // 同步器：主时钟域 -> DDS时钟域
    always @(posedge clk125m or negedge Rst_n) begin
        if (!Rst_n) begin
            // 第一级同步
            wave_sel_sync1 <= 3'd0;
            ftw_sync1 <= 32'd0;
            apply_pulse_sync1 <= 1'b0;
            // 第二级同步
            wave_sel_sync2 <= 3'd0;
            ftw_sync2 <= 32'd0;
            apply_pulse_sync2 <= 1'b0;
            apply_pulse_sync3 <= 1'b0;
        end else begin
            // 第一级同步（使用主时钟域寄存后的信号）
            wave_sel_sync1 <= wave_sel_reg;
            ftw_sync1 <= ftw_reg;
            apply_pulse_sync1 <= apply_pulse_reg;
            // 第二级同步（消除亚稳态）
            wave_sel_sync2 <= wave_sel_sync1;
            ftw_sync2 <= ftw_sync1;
            apply_pulse_sync2 <= apply_pulse_sync1;
            apply_pulse_sync3 <= apply_pulse_sync2;
        end
    end
    
    // 检测应用脉冲的上升沿（在DDS时钟域）
    wire dds_apply_rise = apply_pulse_sync2 & ~apply_pulse_sync3;

    // ==================== DDS参数寄存器（DDS时钟域） ====================
    reg [2:0] wave_sel_dds;
    reg [31:0] ftw_dds;
    
    always @(posedge clk125m or negedge Rst_n) begin
        if (!Rst_n) begin
            wave_sel_dds <= 3'd0;
            ftw_dds <= 32'd0;
        end else if (dds_apply_rise) begin
            // 在DDS时钟域安全地更新参数
            wave_sel_dds <= wave_sel_sync2;
            ftw_dds <= ftw_sync2;
        end
    end

    // ==================== DDS核心模块 ====================
    wire [7:0] DA_Data;
    wire DA_Clk;
    
    dds_module_host dds_core(
        .Clk(clk125m),           // DDS工作在125MHz时钟
        .Rst_n(Rst_n),
        .wave_sel_in(wave_sel_dds),  // 同步后的波形选择
        .ftw_in(ftw_dds),           // 同步后的频率控制字
        .DA_Clk(DA_Clk),
        .DA_Data(DA_Data)
    );

    // ==================== 输出分配 ====================
    assign DA0_Data = DA_Data;
    assign DA0_Clk = DA_Clk;

endmodule