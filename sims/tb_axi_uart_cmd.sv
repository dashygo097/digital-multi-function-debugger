`timescale 1ns / 1ps

module tb_axi_uart_cmd;

  // Parameters
  localparam int BAUD_RATE = 115200;
  localparam int CLK_FREQ = 50_000_000;  // 50 MHz (matches AXILiteMasterUartCmd instantiation)
  localparam int BIT_PERIOD = CLK_FREQ / BAUD_RATE;  // clock cycles per UART bit

  // Clock and Reset
  reg clock;
  reg reset;

  // UART lines (DUT viewpoint: TXD is output, RXD is input)
  wire uart_tx;  // from DUT
  reg uart_rx;  // to   DUT

  // Test counters
  integer error_count = 0;
  integer test_count = 0;
  integer pass_count = 0;

  // For capturing UART responses (status + 32b payload)
  reg [7:0] rx_bytes[0:4];

  // Instantiate DUT
  axi_cmd_test_module dut (
      .clock(clock),
      .reset(reset),
      .TXD  (uart_tx),
      .RXD  (uart_rx)
  );

  // Clock generation: 100 MHz
  always #5 clock = ~clock;

  // ---------------------------
  // UART Tasks (8N1, LSB first)
  // ---------------------------

  // Drive a UART byte onto RX (into the DUT)
  task automatic uart_send_byte(input [7:0] data);
    integer i;
    begin
      // Start bit
      uart_rx = 1'b0;
      repeat (BIT_PERIOD) @(posedge clock);

      // 8 data bits, LSB first
      for (i = 0; i < 8; i = i + 1) begin
        uart_rx = data[i];
        repeat (BIT_PERIOD) @(posedge clock);
      end

      // Stop bit
      uart_rx = 1'b1;
      repeat (BIT_PERIOD) @(posedge clock);
    end
  endtask

  // Sample a UART byte from TX (from the DUT)
  task automatic uart_receive_byte(output [7:0] data);
    integer i;
    begin
      // Wait for start bit
      wait (uart_tx == 1'b0);
      // Sample mid-start bit
      repeat (BIT_PERIOD / 2) @(posedge clock);

      // 8 data bits @ bit centers
      for (i = 0; i < 8; i = i + 1) begin
        repeat (BIT_PERIOD) @(posedge clock);
        data[i] = uart_tx;
      end

      // Stop bit (ignore value, just advance)
      repeat (BIT_PERIOD) @(posedge clock);
    end
  endtask

  // ---------------------------
  // Protocol helpers (9B cmds)
  // Format (all cmds): [opcode(1)][addr(4)][data(4)]
  // Opcodes: 0x00=WRITE, 0x01=READ, 0x02=MOVE (addr=src, data=dst)
  // Response: 5 bytes = [status(1)] + [data(4, LSB..MSB)]
  // ---------------------------

  // WRITE: returns status + readback (implementation-dependent; we capture anyway)
  task automatic uart_write_cmd(input [31:0] addr, input [31:0] data);
    begin
      $display("UART WRITE: addr=0x%08h data=0x%08h", addr, data);

      uart_send_byte(8'h00);
      uart_send_byte(addr[7:0]);
      uart_send_byte(addr[15:8]);
      uart_send_byte(addr[23:16]);
      uart_send_byte(addr[31:24]);
      uart_send_byte(data[7:0]);
      uart_send_byte(data[15:8]);
      uart_send_byte(data[23:16]);
      uart_send_byte(data[31:24]);

      uart_receive_byte(rx_bytes[0]);
      uart_receive_byte(rx_bytes[1]);
      uart_receive_byte(rx_bytes[2]);
      uart_receive_byte(rx_bytes[3]);
      uart_receive_byte(rx_bytes[4]);

      $display("  -> resp: status=0x%02h data=0x%02h%02h%02h%02h", rx_bytes[0], rx_bytes[4],
               rx_bytes[3], rx_bytes[2], rx_bytes[1]);
    end
  endtask

  // READ: returns status + data
  task automatic uart_read_cmd(input [31:0] addr, output [31:0] data);
    begin
      $display("UART READ:  addr=0x%08h", addr);

      uart_send_byte(8'h01);
      uart_send_byte(addr[7:0]);
      uart_send_byte(addr[15:8]);
      uart_send_byte(addr[23:16]);
      uart_send_byte(addr[31:24]);
      // 4 dummy bytes
      uart_send_byte(8'h00);
      uart_send_byte(8'h00);
      uart_send_byte(8'h00);
      uart_send_byte(8'h00);

      uart_receive_byte(rx_bytes[0]);
      uart_receive_byte(rx_bytes[1]);
      uart_receive_byte(rx_bytes[2]);
      uart_receive_byte(rx_bytes[3]);
      uart_receive_byte(rx_bytes[4]);

      data = {rx_bytes[4], rx_bytes[3], rx_bytes[2], rx_bytes[1]};
      $display("  -> resp: status=0x%02h data=0x%08h", rx_bytes[0], data);
    end
  endtask

  // MOVE: [0x02][src(4)][dst(4)] -> returns status + moved-data
  task automatic uart_move_cmd(input [31:0] src_addr, input [31:0] dst_addr,
                               output [31:0] moved_data);
    begin
      $display("UART MOVE:  src=0x%08h -> dst=0x%08h", src_addr, dst_addr);

      uart_send_byte(8'h02);
      uart_send_byte(src_addr[7:0]);
      uart_send_byte(src_addr[15:8]);
      uart_send_byte(src_addr[23:16]);
      uart_send_byte(src_addr[31:24]);
      uart_send_byte(dst_addr[7:0]);
      uart_send_byte(dst_addr[15:8]);
      uart_send_byte(dst_addr[23:16]);
      uart_send_byte(dst_addr[31:24]);

      uart_receive_byte(rx_bytes[0]);
      uart_receive_byte(rx_bytes[1]);
      uart_receive_byte(rx_bytes[2]);
      uart_receive_byte(rx_bytes[3]);
      uart_receive_byte(rx_bytes[4]);

      moved_data = {rx_bytes[4], rx_bytes[3], rx_bytes[2], rx_bytes[1]};
      $display("  -> resp: status=0x%02h moved=0x%08h", rx_bytes[0], moved_data);
    end
  endtask

  // ---------------------------
  // Check helpers
  // ---------------------------

  task automatic check_uart_read(input [31:0] addr, input [31:0] expected);
    reg [31:0] rdata;
    begin
      uart_read_cmd(addr, rdata);
      test_count = test_count + 1;
      if (rdata !== expected) begin
        error_count = error_count + 1;
        $display("    ✗ FAIL @0x%08h: expected 0x%08h, got 0x%08h", addr, expected, rdata);
      end else begin
        pass_count = pass_count + 1;
        $display("    ✓ PASS @0x%08h: 0x%08h", addr, rdata);
      end
    end
  endtask

  task automatic check_uart_move(input [31:0] src_addr, input [31:0] dst_addr,
                                 input [31:0] src_value);
    reg [31:0] moved;
    begin
      // Prime source and destination
      uart_write_cmd(src_addr, src_value);
      uart_write_cmd(dst_addr, 32'hDEAD_0000);

      // Issue move and verify response equals source value
      uart_move_cmd(src_addr, dst_addr, moved);
      test_count = test_count + 1;
      if (moved !== src_value) begin
        error_count = error_count + 1;
        $display("    ✗ MOVE resp mismatch: exp=0x%08h got=0x%08h", src_value, moved);
      end else begin
        pass_count = pass_count + 1;
        $display("    ✓ MOVE resp correct:  0x%08h", moved);
      end

      // Destination updated, source unchanged
      check_uart_read(dst_addr, src_value);
      check_uart_read(src_addr, src_value);
    end
  endtask

  // ---------------------------
  // Init and main sequence
  // ---------------------------

  initial begin
    clock   = 1'b0;
    reset   = 1'b1;
    uart_rx = 1'b1;  // idle high
  end

  initial begin
    $display("\nAXI UART CMD Top Testbench (tb_axi_testcase_1)");
    $display("CLK_FREQ=%0d Hz, BAUD=%0d, BIT_PERIOD=%0d cycles", CLK_FREQ, BAUD_RATE, BIT_PERIOD);
    $dumpfile("axi_cmd_tb.vcd");
    $dumpvars(0, tb_axi_testcase_1);

    // Reset pulse
    #100;
    reset = 1'b0;
    #200;

    // Address map (from design):
    //   Reg bank: 0x00010000, 0x00014000, 0x00018000, 0x0001C000
    //   RAM (via lite2full bridge): 0x00020000 .. 0x0002001C (8 words)

    // Test 1: Initial reset values in register bank
    $display("\n[Test 1] Register bank reset values");
    check_uart_read(32'h0001_0000, 32'h0000_0000);
    check_uart_read(32'h0001_4000, 32'h0000_0000);
    check_uart_read(32'h0001_8000, 32'h0000_0000);
    check_uart_read(32'h0001_C000, 32'h0000_0000);

    // Test 2: Basic write/read regs
    $display("\n[Test 2] Basic write/read to regs");
    uart_write_cmd(32'h0001_0000, 32'hDEAD_BEEF);
    check_uart_read(32'h0001_0000, 32'hDEAD_BEEF);

    uart_write_cmd(32'h0001_4000, 32'h1234_5678);
    check_uart_read(32'h0001_4000, 32'h1234_5678);

    uart_write_cmd(32'h0001_8000, 32'hABCD_EF01);
    check_uart_read(32'h0001_8000, 32'hABCD_EF01);

    uart_write_cmd(32'h0001_C000, 32'h8765_4321);
    check_uart_read(32'h0001_C000, 32'h8765_4321);

    // Test 3: Pattern tests
    $display("\n[Test 3] Pattern tests (regs)");
    uart_write_cmd(32'h0001_0000, 32'h0F0F_0F0F);
    uart_write_cmd(32'h0001_4000, 32'hF0F0_F0F0);
    uart_write_cmd(32'h0001_8000, 32'hFFFF_0000);
    uart_write_cmd(32'h0001_C000, 32'h0000_FFFF);

    check_uart_read(32'h0001_0000, 32'h0F0F_0F0F);
    check_uart_read(32'h0001_4000, 32'hF0F0_F0F0);
    check_uart_read(32'h0001_8000, 32'hFFFF_0000);
    check_uart_read(32'h0001_C000, 32'h0000_FFFF);

    // Test 4: RAM basic write/read through interconnect+bridge
    $display("\n[Test 4] RAM basic write/read");
    uart_write_cmd(32'h0002_0000, 32'h1122_3344);
    uart_write_cmd(32'h0002_0004, 32'h5566_7788);
    uart_write_cmd(32'h0002_0008, 32'h99AA_BBCC);
    uart_write_cmd(32'h0002_000C, 32'hDDEE_FF00);

    check_uart_read(32'h0002_0000, 32'h1122_3344);
    check_uart_read(32'h0002_0004, 32'h5566_7788);
    check_uart_read(32'h0002_0008, 32'h99AA_BBCC);
    check_uart_read(32'h0002_000C, 32'hDDEE_FF00);

    // Test 5: Interleaved accesses (regs and RAM)
    $display("\n[Test 5] Interleaved regs and RAM");
    uart_write_cmd(32'h0001_0000, 32'h1111_1111);
    uart_write_cmd(32'h0002_0000, 32'h2222_2222);
    uart_write_cmd(32'h0001_4000, 32'h3333_3333);
    uart_write_cmd(32'h0002_0004, 32'h4444_4444);

    check_uart_read(32'h0001_0000, 32'h1111_1111);
    check_uart_read(32'h0002_0000, 32'h2222_2222);
    check_uart_read(32'h0001_4000, 32'h3333_3333);
    check_uart_read(32'h0002_0004, 32'h4444_4444);

    // Test 6: Back-to-back reads
    $display("\n[Test 6] Back-to-back reads");
    check_uart_read(32'h0001_0000, 32'h1111_1111);
    check_uart_read(32'h0002_0000, 32'h2222_2222);
    check_uart_read(32'h0001_4000, 32'h3333_3333);
    check_uart_read(32'h0002_0004, 32'h4444_4444);

    // Test 7: MOVE command (within regs)
    $display("\n[Test 7] MOVE command (regs)");
    check_uart_move(32'h0001_0000, 32'h0001_4000, 32'h55AA_33CC);
    check_uart_move(32'h0001_8000, 32'h0001_C000, 32'h0BAD_F00D);

    // Test 8: MOVE command (RAM -> RAM)
    $display("\n[Test 8] MOVE command (RAM)");
    // Prime locations
    uart_write_cmd(32'h0002_0000, 32'h1122_3344);
    uart_write_cmd(32'h0002_0010, 32'h5566_7788);

    // Move 0x20000 -> 0x20010
    begin
      reg [31:0] mv;
      uart_move_cmd(32'h0002_0000, 32'h0002_0010, mv);
      check_uart_read(32'h0002_0010, 32'h1122_3344);
    end

    // Move chain: 0x20010 -> 0x20018
    begin
      reg [31:0] mv;
      uart_move_cmd(32'h0002_0010, 32'h0002_0018, mv);
      check_uart_read(32'h0002_0018, 32'h1122_3344);
    end

    // Test 9: Reset behavior
    $display("\n[Test 9] Reset behavior (regs reset to zero; RAM typically retains)");
    // Write some regs
    uart_write_cmd(32'h0001_0000, 32'hAAAA_AAAA);
    uart_write_cmd(32'h0001_4000, 32'hBBBB_BBBB);
    uart_write_cmd(32'h0001_8000, 32'hCCCC_CCCC);
    uart_write_cmd(32'h0001_C000, 32'hDDDD_DDDD);
    // Write RAM reference
    uart_write_cmd(32'h0002_0000, 32'h1234_1234);

    // Reset
    #200;
    reset = 1'b1;
    #100;
    reset = 1'b0;
    #300;

    // Regs should reset to zero
    check_uart_read(32'h0001_0000, 32'h0000_0000);
    check_uart_read(32'h0001_4000, 32'h0000_0000);
    check_uart_read(32'h0001_8000, 32'h0000_0000);
    check_uart_read(32'h0001_C000, 32'h0000_0000);

    // RAM behavior after reset (write again then read)
    uart_write_cmd(32'h0002_0000, 32'h1234_5678);
    check_uart_read(32'h0002_0000, 32'h1234_5678);

    // Summary
    #1000;
    $display("\n================================================");
    $display("Test Summary:");
    $display("  Total: %0d", test_count);
    $display("  Pass:  %0d", pass_count);
    $display("  Fail:  %0d", error_count);
    if (error_count == 0) $display("✓ ALL TESTS PASSED!");
    else $display("✗ SOME TESTS FAILED!");
    $display("================================================\n");

    #1000;
    $finish;
  end

  // Optional global timeout
  initial begin
    #100_000_000;
    $display("\n✗ ERROR: Simulation timeout!");
    $finish;
  end

endmodule
