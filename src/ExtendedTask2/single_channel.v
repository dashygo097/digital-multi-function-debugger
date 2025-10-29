module bitseq_player #(
    parameter AW = 8
) (
    input wire        clk,
    input wire        rst_n,
    input wire        start_trig,  // 起播脉冲
    input wire        stop,        // 同步停止(拉高即停)
    input wire [AW:0] len,
    input wire [31:0] rate_div,    //信号变化速率
    input wire [31:0] phase_off,   //输出延迟

    input wire          wr_en,    // 写使能
    input wire [AW-1:0] wr_addr,  // 写地址
    input wire          wr_bit,   // 写数据(1bit)

    output reg io_out,  // 输出到该通道的IO脚
    output reg playing  // 播放中指示
);

  // 1bit 序列存储(组合读 → LUTRAM)
  reg mem[0:(1<<AW)-1];

  always @(posedge clk) begin
    if (wr_en && !playing) mem[wr_addr] <= wr_bit;
  end

  reg  [AW:0] ptr;
  reg  [31:0] div_cnt;
  reg  [31:0] phs_cnt;
  wire        at_last = (ptr == (len - 1'b1));  // 是否到序列末尾

  // 组合读当前位(综合到LUTRAM，零延迟/极小延迟)
  wire        nxt_bit = mem[ptr[AW-1:0]];

  always @(posedge clk or negedge rst_n) begin
    if (!rst_n) begin
      playing <= 1'b0;
      io_out  <= 1'b0;
      ptr     <= '0;
      div_cnt <= 32'd0;
      phs_cnt <= 32'd0;
    end else begin
      // 起播
      if (start_trig && !playing) begin
        playing <= 1'b1;
        io_out  <= 1'b0;
        ptr     <= '0;
        div_cnt <= 32'd0;
        phs_cnt <= phase_off;
      end  // 停止
      else if (stop) begin
        playing <= 1'b0;
        io_out  <= 1'b0;
      end  // 播放进行中
      else if (playing) begin

        if (phs_cnt != 0) begin
          phs_cnt <= phs_cnt - 1'b1;
        end else begin

          if (div_cnt == rate_div) begin
            div_cnt <= 32'd0;
            io_out  <= nxt_bit;
            ptr     <= at_last ? '0 : (ptr + 1'b1);
          end else begin
            div_cnt <= div_cnt + 1'b1;
          end
        end
      end
    end
  end

endmodule
