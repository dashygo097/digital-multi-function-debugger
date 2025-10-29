`timescale 1ns / 1ps

module signal_measure_ctrl #(
    parameter CLK_FREQ   = 50_000_000,  // Hz
    parameter AVG_CYCLES = 8            // 连续测量周期数，可调
) (
    input wire clk,
    input wire rst_n,
    input wire enable,
    input wire sig_in,

    output reg        busy,
    output reg        finish,
    output reg [25:0] period_out,
    output reg [ 7:0] duty,
    output reg [19:0] high_time,
    output reg [19:0] low_time
);

  //============================
  // 信号同步与上升沿检测
  //============================
  reg sig_d1, sig_d2;
  wire rise;

  always @(posedge clk or negedge rst_n)
    if (!rst_n) {sig_d1, sig_d2} <= 2'b00;
    else {sig_d1, sig_d2} <= {sig_d2, sig_in};

  assign rise = (~sig_d1 & sig_d2);  // 上升沿检测

  //============================
  // 内部寄存器
  //============================
  reg [31:0] cnt_period;  // 连续计时计数器
  reg [31:0] cnt_high;  // 连续高电平计数
  reg [ 7:0] cycle_cnt;  // 已计周期数
  reg        start_flag;  // 检测到第一个上升沿后开始测量

  //============================
  // 主控制逻辑
  //============================
  always @(posedge clk or negedge rst_n) begin
    if (!rst_n) begin
      busy       <= 1'b0;
      finish     <= 1'b0;
      cnt_period <= 32'd0;
      cnt_high   <= 32'd0;
      cycle_cnt  <= 8'd0;
      start_flag <= 1'b0;
    end else begin
      finish <= 1'b0;

      // 启动测量
      if (enable && !busy) begin
        busy       <= 1'b1;
        cnt_period <= 32'd0;
        cnt_high   <= 32'd0;
        cycle_cnt  <= 8'd0;
        start_flag <= 1'b0;
      end  // 测量中
      else if (busy) begin
        cnt_period <= cnt_period + 1'b1;
        if (sig_d2) cnt_high <= cnt_high + 1'b1;

        // 第一个上升沿：标记起点并清零
        if (!start_flag && rise) begin
          cnt_period <= 32'd0;
          cnt_high   <= 32'd0;
          cycle_cnt  <= 8'd0;
          start_flag <= 1'b1;
        end  // 后续上升沿：累计周期数
        else if (start_flag && rise) begin
          cycle_cnt <= cycle_cnt + 1'b1;
          // 到达 N 周期结束
          if (cycle_cnt + 1 == AVG_CYCLES) begin
            busy       <= 1'b0;
            finish     <= 1'b1;
            start_flag <= 1'b0;
          end
        end
      end
    end
  end

  //============================
  // 结果计算逻辑
  //============================
  reg [31:0] duty_temp;
  reg [31:0] period_buf;
  reg [31:0] high_buf;
  reg [31:0] low_buf;

  always @(posedge clk or negedge rst_n)
    if (!rst_n) begin
      period_out <= 0;
      duty       <= 0;
      high_time  <= 0;
      low_time   <= 0;
    end else if (finish) begin
      if (cnt_period != 0) begin
        period_out <= cnt_period;
        high_time  <= cnt_high;
      end
    end

endmodule
