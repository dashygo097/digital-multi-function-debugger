`timescale 1ns / 1ps

module tb_axi_master_slave ();

  // Parameters
  parameter integer C_AXI_DATA_WIDTH = 32;
  parameter integer C_AXI_ADDR_WIDTH = 32;

  // Clock and Reset
  reg clock;
  reg reset;

  // Master Control Interface
  reg [31:0] W_DATA;
  reg [31:0] W_ADDR;
  reg W_EN;
  wire W_READY;
  wire [1:0] W_RESP;

  reg [31:0] R_ADDR;
  reg R_EN;
  wire [31:0] R_DATA;
  wire R_READY;
  wire [1:0] R_RESP;

  // AXI Bus Signals (connecting master to slave)
  wire [31:0] M_AXI_AWADDR;
  wire [2:0] M_AXI_AWPROT;
  wire M_AXI_AWVALID;
  wire M_AXI_AWREADY;

  wire [31:0] M_AXI_WDATA;
  wire [3:0] M_AXI_WSTRB;
  wire M_AXI_WVALID;
  wire M_AXI_WREADY;

  wire [1:0] M_AXI_BRESP;
  wire M_AXI_BVALID;
  wire M_AXI_BREADY;

  wire [31:0] M_AXI_ARADDR;
  wire [2:0] M_AXI_ARPROT;
  wire M_AXI_ARVALID;
  wire M_AXI_ARREADY;

  wire [31:0] M_AXI_RDATA;
  wire [1:0] M_AXI_RRESP;
  wire M_AXI_RVALID;
  wire M_AXI_RREADY;

  // Test variables
  reg [31:0] expected_data;
  reg [31:0] read_data;
  integer error_count = 0;
  integer test_count = 0;

  // Instantiate the AXI Master
  axilite_master_32x32 master (
      .clock(clock),
      .reset(reset),
      // AXI Interface
      .M_AXI_AWADDR(M_AXI_AWADDR),
      .M_AXI_AWPROT(M_AXI_AWPROT),
      .M_AXI_AWVALID(M_AXI_AWVALID),
      .M_AXI_AWREADY(M_AXI_AWREADY),
      .M_AXI_WDATA(M_AXI_WDATA),
      .M_AXI_WSTRB(M_AXI_WSTRB),
      .M_AXI_WVALID(M_AXI_WVALID),
      .M_AXI_WREADY(M_AXI_WREADY),
      .M_AXI_BRESP(M_AXI_BRESP),
      .M_AXI_BVALID(M_AXI_BVALID),
      .M_AXI_BREADY(M_AXI_BREADY),
      .M_AXI_ARADDR(M_AXI_ARADDR),
      .M_AXI_ARPROT(M_AXI_ARPROT),
      .M_AXI_ARVALID(M_AXI_ARVALID),
      .M_AXI_ARREADY(M_AXI_ARREADY),
      .M_AXI_RDATA(M_AXI_RDATA),
      .M_AXI_RRESP(M_AXI_RRESP),
      .M_AXI_RVALID(M_AXI_RVALID),
      .M_AXI_RREADY(M_AXI_RREADY),
      // Control Interface
      .W_DATA(W_DATA),
      .W_ADDR(W_ADDR),
      .W_EN(W_EN),
      .W_READY(W_READY),
      .W_RESP(W_RESP),
      .R_ADDR(R_ADDR),
      .R_EN(R_EN),
      .R_DATA(R_DATA),
      .R_READY(R_READY),
      .R_RESP(R_RESP)
  );

  // Instantiate the AXI Slave
  axilite_slave_mmap_32x32_r4 slave (
      .clock(clock),
      .reset(reset),
      .S_AXI_AWADDR(M_AXI_AWADDR),
      .S_AXI_AWPROT(M_AXI_AWPROT),
      .S_AXI_AWVALID(M_AXI_AWVALID),
      .S_AXI_AWREADY(M_AXI_AWREADY),
      .S_AXI_WDATA(M_AXI_WDATA),
      .S_AXI_WSTRB(M_AXI_WSTRB),
      .S_AXI_WVALID(M_AXI_WVALID),
      .S_AXI_WREADY(M_AXI_WREADY),
      .S_AXI_BRESP(M_AXI_BRESP),
      .S_AXI_BVALID(M_AXI_BVALID),
      .S_AXI_BREADY(M_AXI_BREADY),
      .S_AXI_ARADDR(M_AXI_ARADDR),
      .S_AXI_ARPROT(M_AXI_ARPROT),
      .S_AXI_ARVALID(M_AXI_ARVALID),
      .S_AXI_ARREADY(M_AXI_ARREADY),
      .S_AXI_RDATA(M_AXI_RDATA),
      .S_AXI_RRESP(M_AXI_RRESP),
      .S_AXI_RVALID(M_AXI_RVALID),
      .S_AXI_RREADY(M_AXI_RREADY)
  );

  // Clock generation (10ns period = 100MHz)
  always #5 clock = ~clock;

  // Task to perform master write transaction
  task master_write;
    input [31:0] addr;
    input [31:0] data;
    begin
      @(posedge clock);
      W_ADDR = addr;
      W_DATA = data;
      W_EN   = 1'b1;

      @(posedge clock);
      W_EN = 1'b0;

      // Wait for write to complete
      wait (W_READY == 1'b1);
      @(posedge clock);

      // Check write response
      if (W_RESP != 2'b00) begin
        $display("WARNING: Write response error at addr 0x%h: RESP=%b", addr, W_RESP);
      end

      $display("Master Write: Addr=0x%h, Data=0x%h, RESP=%b", addr, data, W_RESP);
    end
  endtask

  // Task to perform master read transaction
  task master_read;
    input [31:0] addr;
    output [31:0] data;
    begin
      @(posedge clock);
      R_ADDR = addr;
      R_EN   = 1'b1;

      @(posedge clock);
      R_EN = 1'b0;

      // Wait for read to complete
      wait (R_READY == 1'b1);
      @(posedge clock);

      data = R_DATA;

      // Check read response
      if (R_RESP != 2'b00) begin
        $display("WARNING: Read response error at addr 0x%h: RESP=%b", addr, R_RESP);
      end

      $display("Master Read: Addr=0x%h, Data=0x%h, RESP=%b", addr, data, R_RESP);
    end
  endtask

  // Task to check read data against expected value
  task check_read_data;
    input [31:0] addr;
    input [31:0] expected;
    begin
      master_read(addr, read_data);
      test_count = test_count + 1;

      if (read_data !== expected) begin
        $display("ERROR: Address 0x%h - Expected: 0x%h, Got: 0x%h", addr, expected, read_data);
        error_count = error_count + 1;
      end else begin
        $display("PASS: Address 0x%h - Data: 0x%h", addr, read_data);
      end
    end
  endtask

  // Initialize signals
  initial begin
    clock  = 0;
    reset  = 1;
    W_DATA = 0;
    W_ADDR = 0;
    W_EN   = 0;
    R_ADDR = 0;
    R_EN   = 0;
  end

  // Main test sequence
  initial begin
    $display("Starting AXI4-Lite Master-Slave Testbench");
    $display("==========================================");
    $dumpfile("axi_master_slave.vcd");
    $dumpvars(0, tb_axi_master_slave);

    // Reset sequence
    #100;
    reset = 0;
    #100;

    // Test 1: Check initial reset values
    $display("\nTest 1: Checking initial reset values");
    check_read_data(32'h10000, 32'h00000000);  // slv_reg0
    check_read_data(32'h14000, 32'h00000000);  // slv_reg1
    check_read_data(32'h18000, 32'h00000000);  // slv_reg2
    check_read_data(32'h1C000, 32'h00000000);  // slv_reg3

    // Test 2: Basic write and read operations
    $display("\nTest 2: Basic write and read operations");
    master_write(32'h10000, 32'hDEADBEEF);
    check_read_data(32'h10000, 32'hDEADBEEF);

    master_write(32'h14000, 32'h12345678);
    check_read_data(32'h14000, 32'h12345678);

    master_write(32'h18000, 32'hABCDEF01);
    check_read_data(32'h18000, 32'hABCDEF01);

    master_write(32'h1C000, 32'h87654321);
    check_read_data(32'h1C000, 32'h87654321);

    // Test 3: Sequential writes followed by reads
    $display("\nTest 3: Sequential writes followed by reads");
    master_write(32'h10000, 32'hAAAAAAAA);
    master_write(32'h14000, 32'h55555555);
    master_write(32'h18000, 32'hFFFFFFFF);
    master_write(32'h1C000, 32'h00000000);

    check_read_data(32'h10000, 32'hAAAAAAAA);
    check_read_data(32'h14000, 32'h55555555);
    check_read_data(32'h18000, 32'hFFFFFFFF);
    check_read_data(32'h1C000, 32'h00000000);

    // Test 4: Interleaved write and read operations
    $display("\nTest 4: Interleaved write and read operations");
    master_write(32'h10000, 32'h11111111);
    check_read_data(32'h10000, 32'h11111111);
    master_write(32'h14000, 32'h22222222);
    check_read_data(32'h14000, 32'h22222222);

    // Test 5: Reset functionality
    $display("\nTest 5: Reset functionality");
    reset = 1;
    #50;
    reset = 0;
    #100;

    // Check all registers are reset to 0
    check_read_data(32'h10000, 32'h00000000);
    check_read_data(32'h14000, 32'h00000000);
    check_read_data(32'h18000, 32'h00000000);
    check_read_data(32'h1C000, 32'h00000000);

    // Test 6: Pattern tests
    $display("\nTest 6: Pattern tests");
    master_write(32'h10000, 32'h0F0F0F0F);
    check_read_data(32'h10000, 32'h0F0F0F0F);

    master_write(32'h14000, 32'hF0F0F0F0);
    check_read_data(32'h14000, 32'hF0F0F0F0);

    master_write(32'h18000, 32'hFFFF0000);
    check_read_data(32'h18000, 32'hFFFF0000);

    master_write(32'h1C000, 32'h0000FFFF);
    check_read_data(32'h1C000, 32'h0000FFFF);

    // Test 7: Back-to-back transactions
    $display("\nTest 7: Back-to-back read transactions");
    check_read_data(32'h10000, 32'h0F0F0F0F);
    check_read_data(32'h14000, 32'hF0F0F0F0);
    check_read_data(32'h18000, 32'hFFFF0000);
    check_read_data(32'h1C000, 32'h0000FFFF);

    // Test Summary
    $display("\n==========================================");
    $display("Test Summary:");
    $display("Total Tests: %d", test_count);
    $display("Errors: %d", error_count);

    if (error_count == 0) begin
      $display("ALL TESTS PASSED!");
    end else begin
      $display("TESTS FAILED!");
    end

    $display("==========================================");

    #100;
    $finish;
  end

  // Monitor for debugging
  initial begin
    $monitor(
        "Time=%0t | RST=%b | W_EN=%b W_RDY=%b | R_EN=%b R_RDY=%b | AW_V=%b AW_R=%b | W_V=%b W_R=%b | B_V=%b B_R=%b | AR_V=%b AR_R=%b | R_V=%b R_R=%b",
        $time, reset, W_EN, W_READY, R_EN, R_READY, M_AXI_AWVALID, M_AXI_AWREADY, M_AXI_WVALID,
        M_AXI_WREADY, M_AXI_BVALID, M_AXI_BREADY, M_AXI_ARVALID, M_AXI_ARREADY, M_AXI_RVALID,
        M_AXI_RREADY);
  end

  // Timeout protection
  initial begin
    #5000;
    $display("ERROR: Simulation timeout!");
    $finish;
  end

endmodule
