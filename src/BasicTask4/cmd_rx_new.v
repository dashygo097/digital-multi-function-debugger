module cmd_rx (
    input        clk,
    input        reset_n,
    input        cmdvalid,
    input [ 7:0] cmd_addr,
    input [31:0] cmd_data,

    output reg [ 7:0] ChannelSel,
    output reg [31:0] DataNum,
    output reg [31:0] ADC_Speed_Set,
    output reg        RestartReq,      // 单拍
    output reg        RestartReq_DDS,  // 单拍
    output reg [ 2:0] DDS_WaveSel,
    output reg [31:0] DDS_FTW
);

  always @(posedge clk or negedge reset_n) begin
    if (!reset_n) begin
      ChannelSel     <= 8'hFF;
      DataNum        <= 32'd0;
      ADC_Speed_Set  <= 32'd0;
      RestartReq     <= 1'b0;
      RestartReq_DDS <= 1'b0;
      DDS_WaveSel    <= 3'd0;
      DDS_FTW        <= 32'd0;
    end else begin
      RestartReq     <= 1'b0;
      RestartReq_DDS <= 1'b0;

      if (cmdvalid) begin
        case (cmd_addr)
          8'h00: RestartReq <= 1'b1;  // 单拍
          8'h01: ChannelSel <= cmd_data[7:0];
          8'h02: DataNum <= cmd_data;
          8'h03: ADC_Speed_Set <= cmd_data;

          8'h04: RestartReq_DDS <= 1'b1;  // 单拍
          8'h05: DDS_WaveSel <= cmd_data[2:0];
          8'h06: DDS_FTW <= cmd_data;

          default: ;
        endcase
      end
    end
  end
endmodule
