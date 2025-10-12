`timescale 1ns / 1ps


module signal_measure_ctrl (
    input wire clk,     // 系统时钟（例：50MHz）
    input wire rst_n,   // 异步复位，低有效
    input wire enable,  // 启动测量信号，高电平触发一次测量
    input wire sig_in,  // 待测输入信号

    output reg        busy,       // 测量过程中为高
    output reg        finish,     // 测量完成（1 clk 脉冲）
    output reg [25:0] freq,       // 测得频率（Hz）
    output reg [ 7:0] duty,       // 占空比（%）
    output reg [19:0] high_time,  // 高电平持续时间（时钟周期数）
    output reg [19:0] low_time    // 低电平持续时间（时钟周期数）
);

  parameter CLK_FREQ = 50_000_000;  // 系统时钟频率（Hz）

  //============================
  // 信号同步与边沿检测
  //============================
  reg sig_d1, sig_d2;
  wire rise, fall;

  always @(posedge clk or negedge rst_n)
    if (!rst_n) {sig_d1, sig_d2} <= 2'b00;
    else {sig_d1, sig_d2} <= {sig_d2, sig_in};

  assign rise = (sig_d1 & ~sig_d2);  // 上升沿检测
  assign fall = (~sig_d1 & sig_d2);  // 下降沿检测

  //============================
  // 内部寄存器
  //============================
  reg [19:0] cnt_period;  // 计数周期
  reg [19:0] cnt_high;  // 高电平时间
  reg [19:0] period_buf;  // 暂存周期结果
  reg [19:0] high_buf;  // 暂存高电平结果
  reg        start_flag;  // 已检测到第一个上升沿标志

  //============================
  // 主控制逻辑
  //============================
  always @(posedge clk or negedge rst_n) begin
    if (!rst_n) begin
      busy       <= 1'b0;
      finish     <= 1'b0;
      cnt_period <= 0;
      cnt_high   <= 0;
      start_flag <= 1'b0;
    end else begin
      finish <= 1'b0;  // 默认低电平

      // 启动测量
      if (enable && !busy) begin
        busy       <= 1'b1;
        cnt_period <= 0;
        cnt_high   <= 0;
        start_flag <= 1'b0;
      end  // 测量中
      else if (busy) begin
        cnt_period <= cnt_period + 1;
        if (sig_in) cnt_high <= cnt_high + 1;

        // 第一次上升沿：标记起点
        if (!start_flag && rise) begin
          cnt_period <= 0;
          cnt_high   <= 0;
          start_flag <= 1'b1;
        end  // 第二次上升沿：测量结束
        else if (start_flag && rise) begin
          period_buf <= cnt_period;
          high_buf   <= cnt_high;
          busy       <= 1'b0;
          finish     <= 1'b1;
          start_flag <= 1'b0;
        end
      end
    end
  end

  //============================
  // 结果计算逻辑
  //============================
  always @(posedge clk or negedge rst_n)
    if (!rst_n) begin
      freq <= 0;
      duty <= 0;
      high_time <= 0;
      low_time <= 0;
    end else if (finish) begin
      if (period_buf != 0) begin
        freq      <= CLK_FREQ / {6'b0, period_buf};
        duty      <= ((high_buf * 100) / period_buf)[7:0];
        high_time <= high_buf;
        low_time  <= period_buf - high_buf;
      end
    end

endmodule
