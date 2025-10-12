`timescale 1ns / 1ps

module signal_measure_ctrl #(
    parameter CLK_FREQ   = 50_000_000,  // Hz
    parameter AVG_CYCLES = 8            // 平均测量周期数，可调
)(
    input wire clk,     
    input wire rst_n,   
    input wire enable,  
    input wire sig_in,  

    output reg        busy,       
    output reg        finish,     
    output reg [25:0] freq,       
    output reg [ 7:0] duty,       
    output reg [19:0] high_time,  
    output reg [19:0] low_time    
);

  //============================
  // 信号同步与边沿检测
  //============================
  reg sig_d1, sig_d2;
  wire rise;

  always @(posedge clk or negedge rst_n)
    if (!rst_n)
      {sig_d1, sig_d2} <= 2'b00;
    else
      {sig_d1, sig_d2} <= {sig_d2, sig_in};

  assign rise = (sig_d1 & ~sig_d2);  // 上升沿检测

  //============================
  // 内部寄存器
  //============================
  reg [19:0] cnt_period;     // 当前周期计数
  reg [19:0] cnt_high;       // 当前周期高电平计数
  reg [31:0] sum_period;     // 多周期周期总和
  reg [31:0] sum_high;       // 多周期高电平总和
  reg [7:0]  cycle_cnt;      // 已测周期计数

  reg start_flag;            // 第一个上升沿标志

  //============================
  // 主控制逻辑
  //============================
  always @(posedge clk or negedge rst_n) begin
    if (!rst_n) begin
      busy       <= 1'b0;
      finish     <= 1'b0;
      cnt_period <= 0;
      cnt_high   <= 0;
      sum_period <= 0;
      sum_high   <= 0;
      cycle_cnt  <= 0;
      start_flag <= 1'b0;
    end 
    else begin
      finish <= 1'b0;

      // 启动测量
      if (enable && !busy) begin
        busy       <= 1'b1;
        cnt_period <= 0;
        cnt_high   <= 0;
        sum_period <= 0;
        sum_high   <= 0;
        cycle_cnt  <= 0;
        start_flag <= 1'b0;
      end 

      // 测量中
      else if (busy) begin
        cnt_period <= cnt_period + 1;
        if (sig_in)
          cnt_high <= cnt_high + 1;

        // 第一次上升沿：清零并开始计
        if (!start_flag && rise) begin
          cnt_period <= 0;
          cnt_high   <= 0;
          start_flag <= 1'b1;
        end

        // 检测到后续上升沿
        else if (start_flag && rise) begin
          // 累加当前周期测量
          sum_period <= sum_period + cnt_period;
          sum_high   <= sum_high   + cnt_high;
          cycle_cnt  <= cycle_cnt + 1'b1;

          // 清零计数器，为下一周期准备
          cnt_period <= 0;
          cnt_high   <= 0;

          // 若已测够 AVG_CYCLES 个周期，则结束测量
          if (cycle_cnt + 1 == AVG_CYCLES) begin
            busy   <= 1'b0;
            finish <= 1'b1;
            start_flag <= 1'b0;
          end
        end
      end
    end
  end

  //============================
  // 结果计算逻辑
  //============================
  reg [31:0] freq_temp;
  reg [31:0] duty_temp;

  always @(posedge clk or negedge rst_n)
    if (!rst_n) begin
      freq      <= 0;
      duty      <= 0;
      high_time <= 0;
      low_time  <= 0;
    end else if (finish) begin
      if (sum_period != 0) begin
        // 平均周期和高电平时间
        freq_temp = (CLK_FREQ * AVG_CYCLES) / sum_period;      // f = N * Fclk / ΣT
        duty_temp = (sum_high * 100) / sum_period;             // D = ΣTh / ΣT
        freq      <= freq_temp[25:0];
        duty      <= duty_temp[7:0];
        high_time <= sum_high / AVG_CYCLES;
        low_time  <= (sum_period - sum_high) / AVG_CYCLES;
      end
    end

endmodule
