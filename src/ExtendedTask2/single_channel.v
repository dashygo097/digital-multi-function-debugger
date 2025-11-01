module bitseq_player #(
    parameter AW = 14  // 序列深度 = 2^AW
) (
    input wire clk,
    input wire rst_n,
    input wire start_trig,  // 起播脉冲（1拍）
    input wire stop,        // 停止脉冲（1拍）

    input wire [AW:0] len,
    input wire [31:0] rate_div,  // 位周期 = rate_div + 1（以clk计）
    input wire [31:0] phase_off, // 起播延时（以clk计）

    input wire          wr_en,    // 写使能（仅允许在 !playing 时写）
    input wire [AW-1:0] wr_addr,  // 写地址
    input wire          wr_bit,   // 写数据

    output reg io_out,
    output reg playing
);

  reg mem[0:(1<<AW)-1];


  always @(posedge clk) begin
    if (wr_en && !playing) mem[wr_addr] <= wr_bit;
  end

  reg  [  AW:0] ptr;  // 当前位索引
  wire [  AW:0] ptr_last = (len == 0) ? {{AW{1'b0}}, 1'b0} : (len - 1'b1);
  wire          at_last = (ptr == ptr_last);

  reg  [  31:0] div_cnt;  // 分频计数
  reg  [  31:0] phs_cnt;  // 起播延时计数

  reg  [AW-1:0] rd_addr;  // 本拍送入 BRAM 的读地址
  reg           rd_data;  // 下一拍从 BRAM 读出的位
  reg           rd_valid;  // rd_data 是否已经过了首拍、有效


  // 主状态机：+1拍读延迟的对齐处理（首位预取 + 位周期流水）
  always @(posedge clk or negedge rst_n) begin
    if (!rst_n) begin
      playing  <= 1'b0;
      io_out   <= 1'b0;
      ptr      <= {(AW + 1) {1'b0}};
      div_cnt  <= 32'd0;
      phs_cnt  <= 32'd0;
      rd_addr  <= {AW{1'b0}};
      rd_data  <= 1'b0;
      rd_valid <= 1'b0;
    end else begin
      rd_data <= mem[rd_addr];

      //起播：复位指针/计数；
      if (start_trig && !playing) begin
        playing  <= 1'b1;
        io_out   <= 1'b0;  // 起播前输出为0
        ptr      <= {(AW + 1) {1'b0}};  // 从0位开始
        div_cnt  <= 32'd0;
        phs_cnt  <= phase_off;

        rd_addr  <= {AW{1'b0}};  // 预取 bit[0]（同步读+1拍）
        rd_valid <= 1'b0;  // 下一拍才有效
      end  // ===== 停止：停播并清输出 =====
      else if (stop) begin
        playing  <= 1'b0;
        io_out   <= 1'b0;  // 停止后端口归零
        rd_valid <= 1'b0;  // 失效，防止误用旧数据
      end else if (playing) begin
        if (!rd_valid) rd_valid <= 1'b1;
        if (phs_cnt != 0) begin
          phs_cnt <= phs_cnt - 1'b1;

          rd_addr <= {AW{1'b0}};
        end else begin
          if (div_cnt == rate_div) begin
            div_cnt <= 32'd0;
            if (rd_valid) begin
              io_out <= rd_data;
              ptr    <= at_last ? { (AW+1){1'b0} } : (ptr + 1'b1);
              rd_addr <= at_last ? { AW{1'b0} } : (ptr[AW-1:0] + 1'b1);
            end
          end else begin
            div_cnt <= div_cnt + 1'b1;
          end
        end
      end
    end
  end

endmodule
