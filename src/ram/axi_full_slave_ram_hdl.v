
`timescale 1 ns / 1 ps

module axifull_slave #(
    parameter integer C_S_AXI_ID_WIDTH = 1,
    parameter integer C_S_AXI_DATA_WIDTH = 32,
    parameter integer C_S_AXI_ADDR_WIDTH = 32,
    parameter integer C_S_AXI_AWUSER_WIDTH = 0,
    parameter integer C_S_AXI_ARUSER_WIDTH = 0,
    parameter integer C_S_AXI_WUSER_WIDTH = 0,
    parameter integer C_S_AXI_RUSER_WIDTH = 0,
    parameter integer C_S_AXI_BUSER_WIDTH = 0
) (
    input wire S_AXI_ACLK,
    input wire S_AXI_ARESETN,
    input wire [C_S_AXI_ID_WIDTH-1 : 0] S_AXI_AWID,
    input wire [C_S_AXI_ADDR_WIDTH-1 : 0] S_AXI_AWADDR,
    input wire [7 : 0] S_AXI_AWLEN,
    input wire [2 : 0] S_AXI_AWSIZE,
    input wire [1 : 0] S_AXI_AWBURST,
    input wire S_AXI_AWLOCK,
    input wire [3 : 0] S_AXI_AWCACHE,
    input wire [2 : 0] S_AXI_AWPROT,
    input wire [3 : 0] S_AXI_AWQOS,
    input wire [3 : 0] S_AXI_AWREGION,
    input wire [C_S_AXI_AWUSER_WIDTH-1 : 0] S_AXI_AWUSER,
    input wire S_AXI_AWVALID,
    output wire S_AXI_AWREADY,
    input wire [C_S_AXI_DATA_WIDTH-1 : 0] S_AXI_WDATA,
    input wire [(C_S_AXI_DATA_WIDTH/8)-1 : 0] S_AXI_WSTRB,
    input wire S_AXI_WLAST,
    input wire [C_S_AXI_WUSER_WIDTH-1 : 0] S_AXI_WUSER,
    input wire S_AXI_WVALID,
    output wire S_AXI_WREADY,
    output wire [C_S_AXI_ID_WIDTH-1 : 0] S_AXI_BID,
    output wire [1 : 0] S_AXI_BRESP,
    output wire [C_S_AXI_BUSER_WIDTH-1 : 0] S_AXI_BUSER,
    output wire S_AXI_BVALID,
    input wire S_AXI_BREADY,
    input wire [C_S_AXI_ID_WIDTH-1 : 0] S_AXI_ARID,
    input wire [C_S_AXI_ADDR_WIDTH-1 : 0] S_AXI_ARADDR,
    input wire [7 : 0] S_AXI_ARLEN,
    input wire [2 : 0] S_AXI_ARSIZE,
    input wire [1 : 0] S_AXI_ARBURST,
    input wire S_AXI_ARLOCK,
    input wire [3 : 0] S_AXI_ARCACHE,
    input wire [2 : 0] S_AXI_ARPROT,
    input wire [3 : 0] S_AXI_ARQOS,
    input wire [3 : 0] S_AXI_ARREGION,
    input wire [C_S_AXI_ARUSER_WIDTH-1 : 0] S_AXI_ARUSER,
    input wire S_AXI_ARVALID,
    output wire S_AXI_ARREADY,
    output wire [C_S_AXI_ID_WIDTH-1 : 0] S_AXI_RID,
    output wire [C_S_AXI_DATA_WIDTH-1 : 0] S_AXI_RDATA,
    output wire [1 : 0] S_AXI_RRESP,
    output wire S_AXI_RLAST,
    output wire [C_S_AXI_RUSER_WIDTH-1 : 0] S_AXI_RUSER,
    output wire S_AXI_RVALID,
    input wire S_AXI_RREADY
);

  // AXI4FULL signals
  reg [C_S_AXI_ADDR_WIDTH-1 : 0] axi_awaddr;
  reg axi_awready;
  reg axi_wready;
  reg [1 : 0] axi_bresp;
  reg [C_S_AXI_BUSER_WIDTH-1 : 0] axi_buser;
  reg axi_bvalid;
  reg [C_S_AXI_ADDR_WIDTH-1 : 0] axi_araddr;
  reg axi_arready;
  reg [C_S_AXI_DATA_WIDTH-1 : 0] axi_rdata;
  reg [1 : 0] axi_rresp;
  reg axi_rlast;
  reg [C_S_AXI_RUSER_WIDTH-1 : 0] axi_ruser;
  reg axi_rvalid;
  wire aw_wrap_en;
  wire ar_wrap_en;
  wire [31:0] aw_wrap_size;
  wire [31:0] ar_wrap_size;
  reg axi_awv_awr_flag;
  reg axi_arv_arr_flag;
  reg [7:0] axi_awlen_cntr;
  reg [7:0] axi_arlen_cntr;
  reg [1:0] axi_arburst;
  reg [1:0] axi_awburst;
  reg [7:0] axi_arlen;
  reg [7:0] axi_awlen;

  localparam integer ADDR_LSB = (C_S_AXI_DATA_WIDTH / 32) + 1;
  localparam integer OPT_MEM_ADDR_BITS = 3;
  localparam integer USER_NUM_MEM = 1;

  wire [OPT_MEM_ADDR_BITS:0] mem_address;
  wire [USER_NUM_MEM-1:0] mem_select;
  reg [C_S_AXI_DATA_WIDTH-1:0] mem_data_out[0 : USER_NUM_MEM-1];

  genvar i;
  genvar j;
  genvar mem_byte_index;

  // I/O Connections assignments
  assign S_AXI_AWREADY = axi_awready;
  assign S_AXI_WREADY = axi_wready;
  assign S_AXI_BRESP = axi_bresp;
  assign S_AXI_BUSER = axi_buser;
  assign S_AXI_BVALID = axi_bvalid;
  assign S_AXI_ARREADY = axi_arready;
  assign S_AXI_RDATA = axi_rdata;
  assign S_AXI_RRESP = axi_rresp;
  assign S_AXI_RLAST = axi_rlast;
  assign S_AXI_RUSER = axi_ruser;
  assign S_AXI_RVALID = axi_rvalid;
  assign S_AXI_BID = S_AXI_AWID;
  assign S_AXI_RID = S_AXI_ARID;
  assign aw_wrap_size = (C_S_AXI_DATA_WIDTH / 8 * (axi_awlen));  //the number of bytes
  assign ar_wrap_size = (C_S_AXI_DATA_WIDTH / 8 * (axi_arlen));
  assign aw_wrap_en = ((axi_awaddr & aw_wrap_size) == aw_wrap_size) ? 1'b1 : 1'b0;
  assign ar_wrap_en = ((axi_araddr & ar_wrap_size) == ar_wrap_size) ? 1'b1 : 1'b0;

  // Implement axi_awready generation

  always @(posedge S_AXI_ACLK) begin
    if (S_AXI_ARESETN == 1'b0) begin
      axi_awready <= 1'b0;
      axi_awv_awr_flag <= 1'b0;
    end else begin
      if (~axi_awready && S_AXI_AWVALID && ~axi_awv_awr_flag && ~axi_arv_arr_flag) begin
        axi_awready <= 1'b1;
        axi_awv_awr_flag <= 1'b1;
      end else if (S_AXI_WLAST && axi_wready) begin
        axi_awv_awr_flag <= 1'b0;
      end else begin
        axi_awready <= 1'b0;
      end
    end
  end
  // Implement axi_awaddr latching

  always @(posedge S_AXI_ACLK) begin
    if (S_AXI_ARESETN == 1'b0) begin
      axi_awaddr <= 0;
      axi_awlen_cntr <= 0;
      axi_awburst <= 0;
      axi_awlen <= 0;
    end else begin
      if (~axi_awready && S_AXI_AWVALID && ~axi_awv_awr_flag) begin
        axi_awaddr <= S_AXI_AWADDR[C_S_AXI_ADDR_WIDTH-1:0];
        axi_awburst <= S_AXI_AWBURST;
        axi_awlen <= S_AXI_AWLEN;
        axi_awlen_cntr <= 0;
      end else if ((axi_awlen_cntr <= axi_awlen) && axi_wready && S_AXI_WVALID) begin

        axi_awlen_cntr <= axi_awlen_cntr + 1;

        case (axi_awburst)
          2'b00: begin
            axi_awaddr <= axi_awaddr;
          end
          2'b01: begin
            axi_awaddr[C_S_AXI_ADDR_WIDTH - 1:ADDR_LSB] <= axi_awaddr[C_S_AXI_ADDR_WIDTH - 1:ADDR_LSB] + 1;
            axi_awaddr[ADDR_LSB-1:0] <= {ADDR_LSB{1'b0}};
          end
          2'b10:
          if (aw_wrap_en) begin
            axi_awaddr <= (axi_awaddr - aw_wrap_size);
          end else begin
            axi_awaddr[C_S_AXI_ADDR_WIDTH - 1:ADDR_LSB] <= axi_awaddr[C_S_AXI_ADDR_WIDTH - 1:ADDR_LSB] + 1;
            axi_awaddr[ADDR_LSB-1:0] <= {ADDR_LSB{1'b0}};
          end
          default: begin
            axi_awaddr <= {2'b00, axi_awaddr[C_S_AXI_ADDR_WIDTH-1:ADDR_LSB] + 1'b1};
          end
        endcase
      end
    end
  end
  // Implement axi_wready generation

  always @(posedge S_AXI_ACLK) begin
    if (S_AXI_ARESETN == 1'b0) begin
      axi_wready <= 1'b0;
    end else begin
      if (~axi_wready && S_AXI_WVALID && axi_awv_awr_flag) begin
        axi_wready <= 1'b1;
      end else if (S_AXI_WLAST && axi_wready) begin
        axi_wready <= 1'b0;
      end
    end
  end
  // Implement write response logic generation

  always @(posedge S_AXI_ACLK) begin
    if (S_AXI_ARESETN == 1'b0) begin
      axi_bvalid <= 0;
      axi_bresp  <= 2'b0;
      axi_buser  <= 0;
    end else begin
      if (axi_awv_awr_flag && axi_wready && S_AXI_WVALID && ~axi_bvalid && S_AXI_WLAST) begin
        axi_bvalid <= 1'b1;
        axi_bresp  <= 2'b0;
        // 'OKAY' response 
      end else begin
        if (S_AXI_BREADY && axi_bvalid) begin
          axi_bvalid <= 1'b0;
        end
      end
    end
  end
  // Implement axi_arready generation

  always @(posedge S_AXI_ACLK) begin
    if (S_AXI_ARESETN == 1'b0) begin
      axi_arready <= 1'b0;
      axi_arv_arr_flag <= 1'b0;
    end else begin
      if (~axi_arready && S_AXI_ARVALID && ~axi_awv_awr_flag && ~axi_arv_arr_flag) begin
        axi_arready <= 1'b1;
        axi_arv_arr_flag <= 1'b1;
      end else if (axi_rvalid && S_AXI_RREADY && axi_arlen_cntr == axi_arlen) begin
        axi_arv_arr_flag <= 1'b0;
      end else begin
        axi_arready <= 1'b0;
      end
    end
  end
  // Implement axi_araddr latching
  always @(posedge S_AXI_ACLK) begin
    if (S_AXI_ARESETN == 1'b0) begin
      axi_araddr <= 0;
      axi_arlen_cntr <= 0;
      axi_arburst <= 0;
      axi_arlen <= 0;
      axi_rlast <= 1'b0;
      axi_ruser <= 0;
    end else begin
      if (~axi_arready && S_AXI_ARVALID && ~axi_arv_arr_flag) begin
        axi_araddr <= S_AXI_ARADDR[C_S_AXI_ADDR_WIDTH-1:0];
        axi_arburst <= S_AXI_ARBURST;
        axi_arlen <= S_AXI_ARLEN;
        axi_arlen_cntr <= 0;
        axi_rlast <= 1'b0;
      end else if ((axi_arlen_cntr <= axi_arlen) && axi_rvalid && S_AXI_RREADY) begin

        axi_arlen_cntr <= axi_arlen_cntr + 1;
        axi_rlast <= 1'b0;

        case (axi_arburst)
          2'b00: begin
            axi_araddr <= axi_araddr;
          end
          2'b01: begin
            axi_araddr[C_S_AXI_ADDR_WIDTH - 1:ADDR_LSB] <= axi_araddr[C_S_AXI_ADDR_WIDTH - 1:ADDR_LSB] + 1;
            axi_araddr[ADDR_LSB-1:0] <= {ADDR_LSB{1'b0}};
          end
          2'b10:
          if (ar_wrap_en) begin
            axi_araddr <= (axi_araddr - ar_wrap_size);
          end else begin
            axi_araddr[C_S_AXI_ADDR_WIDTH - 1:ADDR_LSB] <= axi_araddr[C_S_AXI_ADDR_WIDTH - 1:ADDR_LSB] + 1; //每次地址偏移4，直到读取完成busrt_len
            axi_araddr[ADDR_LSB-1:0] <= {ADDR_LSB{1'b0}};
          end
          default: begin
            axi_araddr <= {2'b00, axi_araddr[C_S_AXI_ADDR_WIDTH-1:ADDR_LSB] + 1'b1};
          end
        endcase
      end else if ((axi_arlen_cntr == axi_arlen) && ~axi_rlast && axi_arv_arr_flag) begin
        axi_rlast <= 1'b1;
      end else if (S_AXI_RREADY) begin
        axi_rlast <= 1'b0;
      end
    end
  end
  // Implement axi_arvalid generation

  always @(posedge S_AXI_ACLK) begin
    if (S_AXI_ARESETN == 1'b0) begin
      axi_rvalid <= 0;
      axi_rresp  <= 0;
    end else begin
      if (axi_arv_arr_flag && ~axi_rvalid) begin
        axi_rvalid <= 1'b1;
        axi_rresp  <= 2'b0;
        // 'OKAY' response
      end else if (axi_rvalid && S_AXI_RREADY) begin
        axi_rvalid <= 1'b0;
      end
    end
  end

  generate
    if (USER_NUM_MEM >= 1) begin
      assign mem_select = 1;
      assign mem_address = (axi_arv_arr_flag? axi_araddr[ADDR_LSB+OPT_MEM_ADDR_BITS:ADDR_LSB]:(axi_awv_awr_flag? axi_awaddr[ADDR_LSB+OPT_MEM_ADDR_BITS:ADDR_LSB]:0));
    end
  endgenerate

  // implement Block RAM(s)
  generate
    for (i = 0; i <= USER_NUM_MEM - 1; i = i + 1) begin : BRAM_GEN
      wire mem_rden;
      wire mem_wren;

      assign mem_wren = axi_wready && S_AXI_WVALID;

      assign mem_rden = axi_arv_arr_flag;  //& ~axi_rvalid

      for (
          mem_byte_index = 0;
          mem_byte_index <= (C_S_AXI_DATA_WIDTH / 8 - 1);
          mem_byte_index = mem_byte_index + 1
      ) begin : BYTE_BRAM_GEN
        wire [8-1:0] data_in;
        wire [8-1:0] data_out;
        reg [8-1:0] byte_ram[0 : 15];
        integer j;

        assign data_in  = S_AXI_WDATA[(mem_byte_index*8+7)-:8];
        assign data_out = byte_ram[mem_address];

        always @(posedge S_AXI_ACLK) begin
          if (mem_wren && S_AXI_WSTRB[mem_byte_index]) begin
            byte_ram[mem_address] <= data_in;
          end
        end

        always @(posedge S_AXI_ACLK) begin
          if (mem_rden) begin
            mem_data_out[i][(mem_byte_index*8+7)-:8] <= data_out;
          end
        end

      end
    end
  endgenerate
  //Output register or memory read data

  always @(mem_data_out, axi_rvalid) begin
    if (axi_rvalid) begin
      axi_rdata <= mem_data_out[0];
    end else begin
      axi_rdata <= 32'h00000000;
    end
  end

endmodule
