`timescale 1ns / 1ps

module bram_fifo #(
    parameter DATA_WIDTH = 8,
    parameter FIFO_DEPTH = 1024,
    parameter ADDR_WIDTH = $clog2(FIFO_DEPTH)
) (
    input wire clk,
    input wire rst_n,

    // wirte
    input  wire [DATA_WIDTH-1:0] wr_data,
    input  wire                  wr_en,
    output wire                  full,

    // read
    output wire [DATA_WIDTH-1:0] rd_data,
    input  wire                  rd_en,
    output wire                  empty,

    // data count state output
    output wire [ADDR_WIDTH:0] data_count
);

  // use bram
  (* ram_style = "block" *)
  reg [DATA_WIDTH-1:0] memory[0:FIFO_DEPTH-1];

  // wr and rd pointer
  reg [ADDR_WIDTH:0] wr_ptr = 0;
  reg [ADDR_WIDTH:0] rd_ptr = 0;

  // full and empty
  wire full_signal;
  wire empty_signal;

  // actual wr and rd address
  wire [ADDR_WIDTH-1:0] wr_addr = wr_ptr[ADDR_WIDTH-1:0];
  wire [ADDR_WIDTH-1:0] rd_addr = rd_ptr[ADDR_WIDTH-1:0];

  // data count
  reg [ADDR_WIDTH:0] data_cnt = 0;

  assign full_signal = (data_cnt == FIFO_DEPTH);
  assign empty_signal = (data_cnt == 0);
  assign full = full_signal;
  assign empty = empty_signal;
  assign data_count = data_cnt;

  // rd data output
  reg [DATA_WIDTH-1:0] rd_data_reg;
  assign rd_data = rd_data_reg;

  // wr
  always @(posedge clk or negedge rst_n) begin
    if (!rst_n) begin
      wr_ptr <= 0;
    end else if (wr_en && !full_signal) begin
      memory[wr_addr] <= wr_data;
      wr_ptr <= wr_ptr + 1;
    end
  end

  // rd
  always @(posedge clk or negedge rst_n) begin
    if (!rst_n) begin
      rd_ptr <= 0;
      rd_data_reg <= 0;
    end else if (rd_en && !empty_signal) begin
      rd_data_reg <= memory[rd_addr];
      rd_ptr <= rd_ptr + 1;
    end
  end

  always @(posedge clk or negedge rst_n) begin
    if (!rst_n) begin
      data_cnt <= 0;
    end else begin
      case ({
        wr_en && !full, rd_en && !empty
      })
        2'b00: data_cnt <= data_cnt;  // none
        2'b01: data_cnt <= data_cnt - 1;  // only rd
        2'b10: data_cnt <= data_cnt + 1;  // only wr  
        2'b11: data_cnt <= data_cnt;  // wr and rd
      endcase
    end
  end

endmodule
