`timescale 1ns / 1ps

module tb_axi_interconnect_and_bridge ();

  // Parameters
  parameter integer C_AXI_DATA_WIDTH = 32;
  parameter integer C_AXI_ADDR_WIDTH = 32;
  parameter integer TIMEOUT = 100000;

  // Clock and Reset
  reg clock;
  reg reset;

  // Master Control Interface
  reg [31:0] W_DATA;
  reg [31:0] W_ADDR;
  reg W_EN;
  wire W_DONE;
  wire [1:0] W_RESP;

  reg [31:0] R_ADDR;
  reg R_EN;
  wire [31:0] R_DATA;
  wire R_DONE;
  wire [1:0] R_RESP;
  wire BUSY;

  // Test variables
  reg [31:0] read_data;
  reg [31:0] expected_data;
  integer error_count = 0;
  integer test_count = 0;
  integer pass_count = 0;

  // Instantiate the top module
  axi_interconnect_and_bridge_test_module dut (
      .clock (clock),
      .reset (reset),
      .W_DATA(W_DATA),
      .W_ADDR(W_ADDR),
      .W_EN  (W_EN),
      .W_DONE(W_DONE),
      .W_RESP(W_RESP),
      .R_DATA(R_DATA),
      .R_ADDR(R_ADDR),
      .R_EN  (R_EN),
      .R_DONE(R_DONE),
      .R_RESP(R_RESP),
      .BUSY  (BUSY)
  );

  // Clock generation (10ns period = 100MHz)
  always #5 clock = ~clock;

  // Task to perform master write transaction
  task master_write;
    input [31:0] addr;
    input [31:0] data;
    begin
      @(posedge clock);
      #1;
      W_ADDR = addr;
      W_DATA = data;
      W_EN   = 1'b1;

      // Wait for write done with timeout
      fork
        begin
          wait (W_DONE);
        end
        begin
          repeat (1000) @(posedge clock);
          $display("ERROR: Write transaction timeout at addr 0x%h", addr);
          error_count = error_count + 1;
        end
      join_any
      disable fork;

      @(posedge clock);
      #1;
      W_EN = 1'b0;

      // Wait a bit for transaction to complete
      @(posedge clock);

      // Check write response
      if (W_RESP != 2'b00) begin
        $display("WARNING: Write response error at addr 0x%h: RESP=%b", addr, W_RESP);
      end

      $display("  [WRITE] Addr=0x%08h, Data=0x%08h, RESP=%b", addr, data, W_RESP);
    end
  endtask

  // Task to perform master read transaction
  task master_read;
    input [31:0] addr;
    output [31:0] data;
    begin
      @(posedge clock);
      #1;
      R_ADDR = addr;
      R_EN   = 1'b1;

      // Wait for read done with timeout
      fork
        begin
          wait (R_DONE);
        end
        begin
          repeat (1000) @(posedge clock);
          $display("ERROR: Read transaction timeout at addr 0x%h", addr);
          error_count = error_count + 1;
        end
      join_any
      disable fork;

      @(posedge clock);
      #1;
      R_EN = 1'b0;
      data = R_DATA;

      // Wait a bit for transaction to complete
      @(posedge clock);

      // Check read response
      if (R_RESP != 2'b00) begin
        $display("WARNING: Read response error at addr 0x%h: RESP=%b", addr, R_RESP);
      end

      $display("  [READ]  Addr=0x%08h, Data=0x%08h, RESP=%b", addr, data, R_RESP);
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
        $display("    ✗ FAIL: Expected 0x%08h, Got 0x%08h", expected, read_data);
        error_count = error_count + 1;
      end else begin
        $display("    ✓ PASS: Data match 0x%08h", read_data);
        pass_count = pass_count + 1;
      end
    end
  endtask

  // Task to write and verify
  task write_and_verify;
    input [31:0] addr;
    input [31:0] data;
    begin
      master_write(addr, data);
      #100;
      check_read_data(addr, data);
    end
  endtask

  // Task to verify multiple consecutive reads
  task consecutive_reads;
    input [31:0] addr;
    input integer count;
    input [31:0] expected;
    integer i;
    begin
      for (i = 0; i < count; i = i + 1) begin
        master_read(addr, read_data);
        if (read_data !== expected) begin
          $display("    ✗ FAIL at iteration %d: Expected 0x%08h, Got 0x%08h", i, expected,
                   read_data);
          error_count = error_count + 1;
        end else begin
          pass_count = pass_count + 1;
        end
        test_count = test_count + 1;
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
    $display("\n");
    $display(
        "╔════════════════════════════════════════════════════════════════╗");
    $display("║     AXI Interconnect and Bridge Test Suite                     ║");
    $display(
        "╚════════════════════════════════════════════════════════════════╝");
    $dumpfile("axi_interconnect_bridge.vcd");
    $dumpvars(0, tb_axi_interconnect_and_bridge);

    // Reset sequence
    #100;
    reset = 0;
    #100;

    // Test 1: Slave 1 (Register Bank) - Initial Values
    $display("\n[TEST 1] Slave 1: Register Bank - Initial Reset Values");
    $display(
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    check_read_data(32'h10000, 32'h00000000);  // slv_reg0
    check_read_data(32'h14000, 32'h00000000);  // slv_reg1
    check_read_data(32'h18000, 32'h00000000);  // slv_reg2
    check_read_data(32'h1C000, 32'h00000000);  // slv_reg3

    // Test 2: Slave 1 - Basic Write/Read Operations
    $display("\n[TEST 2] Slave 1: Basic Write and Read Operations");
    $display(
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    write_and_verify(32'h10000, 32'hDEADBEEF);
    write_and_verify(32'h14000, 32'h12345678);
    write_and_verify(32'h18000, 32'hABCDEF01);
    write_and_verify(32'h1C000, 32'h87654321);

    // Test 3: Slave 1 - Pattern Tests
    $display("\n[TEST 3] Slave 1: Pattern Tests");
    $display(
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    write_and_verify(32'h10000, 32'h0F0F0F0F);
    write_and_verify(32'h14000, 32'hF0F0F0F0);
    write_and_verify(32'h18000, 32'hFFFF0000);
    write_and_verify(32'h1C000, 32'h0000FFFF);

    // Test 4: Slave 1 - All Ones and All Zeros
    $display("\n[TEST 4] Slave 1: Extreme Values");
    $display(
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    write_and_verify(32'h10000, 32'hFFFFFFFF);
    write_and_verify(32'h14000, 32'h00000000);
    write_and_verify(32'h18000, 32'hAAAAAAAA);
    write_and_verify(32'h1C000, 32'h55555555);

    // Test 5: Slave 2 (RAM) - Basic Write/Read
    $display("\n[TEST 5] Slave 2: RAM - Basic Write and Read Operations");
    $display(
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    write_and_verify(32'h20000, 32'h11223344);
    write_and_verify(32'h20004, 32'h55667788);
    write_and_verify(32'h20008, 32'h99AABBCC);
    write_and_verify(32'h2000C, 32'hDDEEFF00);

    // Test 6: Slave 2 - Multiple Addresses
    $display("\n[TEST 6] Slave 2: RAM - Multiple Address Locations");
    $display(
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    write_and_verify(32'h20010, 32'hFEDCBA98);
    write_and_verify(32'h20014, 32'h76543210);
    write_and_verify(32'h20018, 32'h13579BDF);
    write_and_verify(32'h2001C, 32'h2468ACE0);

    // Test 7: Interleaved Access - Slave 1 and Slave 2
    $display("\n[TEST 7] Interleaved Access: Slave 1 and Slave 2");
    $display(
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    master_write(32'h10000, 32'h11111111);
    master_write(32'h20000, 32'h22222222);
    master_write(32'h14000, 32'h33333333);
    master_write(32'h20004, 32'h44444444);
    check_read_data(32'h10000, 32'h11111111);
    check_read_data(32'h20000, 32'h22222222);
    check_read_data(32'h14000, 32'h33333333);
    check_read_data(32'h20004, 32'h44444444);

    // Test 8: Sequential Writes Followed by Sequential Reads
    $display("\n[TEST 8] Sequential Operations: Multiple Writes then Reads");
    $display(
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    master_write(32'h10000, 32'hAAAAAAAA);
    master_write(32'h14000, 32'h55555555);
    master_write(32'h18000, 32'hFFFFFFFF);
    master_write(32'h1C000, 32'h00000000);
    master_write(32'h20000, 32'hBBBBBBBB);
    master_write(32'h20004, 32'h66666666);
    #200;
    check_read_data(32'h10000, 32'hAAAAAAAA);
    check_read_data(32'h14000, 32'h55555555);
    check_read_data(32'h18000, 32'hFFFFFFFF);
    check_read_data(32'h1C000, 32'h00000000);
    check_read_data(32'h20000, 32'hBBBBBBBB);
    check_read_data(32'h20004, 32'h66666666);

    // Test 9: Back-to-Back Reads - Address Decoding
    $display("\n[TEST 9] Back-to-Back Reads: Address Decoding Verification");
    $display(
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    consecutive_reads(32'h10000, 3, 32'hAAAAAAAA);
    consecutive_reads(32'h20000, 3, 32'hBBBBBBBB);
    consecutive_reads(32'h14000, 3, 32'h55555555);

    // Test 10: Write-After-Write Same Address
    $display("\n[TEST 10] Write-After-Write: Same Address");
    $display(
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    master_write(32'h10000, 32'h11111111);
    master_write(32'h10000, 32'h22222222);
    master_write(32'h10000, 32'h33333333);
    check_read_data(32'h10000, 32'h33333333);

    master_write(32'h20000, 32'h44444444);
    master_write(32'h20000, 32'h55555555);
    master_write(32'h20000, 32'h66666666);
    check_read_data(32'h20000, 32'h66666666);

    // Test 11: All Slave 1 Registers Write Different Values
    $display("\n[TEST 11] Slave 1: All Registers with Different Values");
    $display(
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    write_and_verify(32'h10000, 32'hCAFECAFE);
    write_and_verify(32'h14000, 32'hDEADBEEF);
    write_and_verify(32'h18000, 32'h12345678);
    write_and_verify(32'h1C000, 32'h9ABCDEF0);

    // Test 12: RAM Address Range - Boundary Testing
    $display("\n[TEST 12] Slave 2: RAM Address Range - Boundary Testing");
    $display(
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    write_and_verify(32'h20000, 32'h11110000);  // First address
    write_and_verify(32'h2001C, 32'h22220000);  // Last address in range

    // Test 13: Reset Functionality
    $display("\n[TEST 13] Reset Functionality - Verify Register Reset");
    $display(
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    master_write(32'h10000, 32'hAAAAAAAA);
    master_write(32'h14000, 32'hBBBBBBBB);
    master_write(32'h18000, 32'hCCCCCCCC);
    master_write(32'h1C000, 32'hDDDDDDDD);
    #100;

    // Issue reset
    reset = 1;
    #50;
    reset = 0;
    #100;

    // Verify all reset to zero
    check_read_data(32'h10000, 32'h00000000);
    check_read_data(32'h14000, 32'h00000000);
    check_read_data(32'h18000, 32'h00000000);
    check_read_data(32'h1C000, 32'h00000000);

    // Test 14: RAM Persistence After Reset (if applicable)
    $display("\n[TEST 14] RAM Behavior After Reset");
    $display(
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    master_write(32'h20000, 32'h12341234);
    #100;
    check_read_data(32'h20000, 32'h12341234);

    // Test 15: Long Address Range Access
    $display("\n[TEST 15] Address Range Verification");
    $display(
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    write_and_verify(32'h10000, 32'h00000001);  // Slave 1 start
    write_and_verify(32'h20000, 32'h00020000);  // Slave 2 start

    // Test 16: Stress Test - Many Operations
    $display("\n[TEST 16] Stress Test - Sequential Operations");
    $display(
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    begin
      integer i;
      for (i = 0; i < 5; i = i + 1) begin
        write_and_verify(32'h20000 + (i * 4), 32'h20000000 + i);
      end
    end

    // Test Summary
    #100;
    $display("\n");
    $display(
        "╔════════════════════════════════════════════════════════════════╗");
    $display("║                      TEST SUMMARY                              ║");
    $display(
        "╚════════════════════════════════════════════════════════════════╝");
    $display("Total Tests:    %d", test_count);
    $display("Passed:         %d", pass_count);
    $display("Failed:         %d", error_count);
    $display("Pass Rate:      %.1f%%", (pass_count * 100.0) / test_count);

    if (error_count == 0) begin
      $display("\n✓ ALL TESTS PASSED!");
    end else begin
      $display("\n✗ TESTS FAILED!");
    end
    $display(
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    #100;
    $finish;
  end

  // Monitor for debugging
  initial begin
    $monitor("T=%0t | RST=%b | BUSY=%b | W_EN=%b W_DONE=%b | R_EN=%b R_DONE=%b", $time, reset,
             BUSY, W_EN, W_DONE, R_EN, R_DONE);
  end

  // Timeout protection
  initial begin
    #TIMEOUT;
    $display("\n✗ ERROR: Simulation timeout!");
    $finish;
  end

endmodule
