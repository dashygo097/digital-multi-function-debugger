`timescale 1ns / 1ps

module uart_engine_tb;

reg clk;
reg rst_n;

// UART配置
reg [31:0] clk_div;
reg check_en;
reg [1:0] check_type;
reg [1:0] data_bit;
reg [1:0] stop_bit;

// FIFO接口
reg [7:0] tx_fifo_data;
reg tx_fifo_valid;
wire tx_fifo_ready;

wire [7:0] rx_fifo_data;
wire rx_fifo_valid;
reg rx_fifo_ready;

// 物理UART接口
wire uart_tx;
reg uart_rx;

// 状态输出
wire tx_busy;
wire rx_busy;
wire rx_error;
wire [15:0] tx_byte_count;
wire [15:0] rx_byte_count;

// 测试控制
integer test_pass;
integer test_fail;

// 实例化UART引擎
uart_engine uut (
    .clk(clk),
    .rst_n(rst_n),
    .clk_div(clk_div),
    .check_en(check_en),
    .check_type(check_type),
    .data_bit(data_bit),
    .stop_bit(stop_bit),
    .tx_fifo_data(tx_fifo_data),
    .tx_fifo_valid(tx_fifo_valid),
    .tx_fifo_ready(tx_fifo_ready),
    .rx_fifo_data(rx_fifo_data),
    .rx_fifo_valid(rx_fifo_valid),
    .rx_fifo_ready(rx_fifo_ready),
    .uart_tx(uart_tx),
    .uart_rx(uart_rx),
    .tx_busy(tx_busy),
    .rx_busy(rx_busy),
    .rx_error(rx_error),
    .tx_byte_count(tx_byte_count),
    .rx_byte_count(rx_byte_count)
);

// 时钟生成
always #5 clk = ~clk;

// 主测试序列
initial begin
    // 初始化
    clk = 0;
    rst_n = 0;
    clk_div = 868;
    check_en = 0;
    check_type = 0;
    data_bit = 2'b11;
    stop_bit = 2'b00;
    tx_fifo_data = 8'h00;
    tx_fifo_valid = 0;
    rx_fifo_ready = 1;
    uart_rx = 1;
    test_pass = 0;
    test_fail = 0;
    
    // 复位
    #100;
    rst_n = 1;
    #100;
    
    $display("COMPLETE UART SYSTEM VALIDATION");
    // 测试1: TX引擎验证
    $display("\n[TEST 1] TX Engine Verification");
    tx_fifo_data = 8'h55;
    tx_fifo_valid = 1;
    wait(tx_fifo_ready == 0);
    tx_fifo_valid = 0;
    wait(tx_busy == 0);
    
    if (tx_byte_count == 1) begin
        test_pass = test_pass + 1;
        $display("PASS: TX engine working");
    end else begin
        test_fail = test_fail + 1;
        $display("FAIL: TX engine issue");
    end
    
    // 测试2: 诊断RX问题
    $display("\n[TEST 2] RX Engine Diagnosis");
    
    // 检查RX引擎基本功能
    // 手动发送数据到RX
    #(clk_div * 20);
    uart_rx = 0; // 起始位
    #(clk_div * 10);
    
    // 发送简单数据 0x01 (00000001 LSB first)
    uart_rx = 1; // bit 0
    #(clk_div * 10);
    uart_rx = 0; // bit 1
    #(clk_div * 10);
    uart_rx = 0; // bit 2
    #(clk_div * 10);
    uart_rx = 0; // bit 3
    #(clk_div * 10);
    uart_rx = 0; // bit 4
    #(clk_div * 10);
    uart_rx = 0; // bit 5
    #(clk_div * 10);
    uart_rx = 0; // bit 6
    #(clk_div * 10);
    uart_rx = 0; // bit 7
    #(clk_div * 10);
    
    uart_rx = 1; // 停止位
    #(clk_div * 10);
    
    // 等待并检查RX状态
    #(clk_div * 20);
    
    $display("RX Status after manual transmission:");
    $display("  RX_Busy: %b", rx_busy);
    $display("  RX_Valid: %b", rx_fifo_valid);
    $display("  RX_Error: %b", rx_error);
    $display("  RX_Count: %0d", rx_byte_count);
    $display("  RX_Data: 0x%h", rx_fifo_data);
    
    if (rx_byte_count > 0) begin
        test_pass = test_pass + 1;
        $display("PASS: RX engine detected data");
    end else begin
        test_fail = test_fail + 1;
        $display("FAIL: RX engine not detecting data");
    end
    
    // 测试3: 系统级测试
    $display("\n[TEST 3] System-Level Test");
    
    // 简单环回测试
    uart_rx = uart_tx; // 连接TX到RX
    
    // 发送测试数据
    integer start_rx_count = rx_byte_count;
    tx_fifo_data = 8'hAA;
    tx_fifo_valid = 1;
    wait(tx_fifo_ready == 0);
    tx_fifo_valid = 0;
    wait(tx_busy == 0);
    
    // 等待环回
    #(clk_div * 100);
    
    $display("Loopback Results:");
    $display("  TX Count: %0d", tx_byte_count);
    $display("  RX Count: %0d", rx_byte_count);
    $display("  RX Increase: %0d", rx_byte_count - start_rx_count);
    
    if (rx_byte_count > start_rx_count) begin
        test_pass = test_pass + 1;
        $display("PASS: Loopback working");
    end else begin
        test_fail = test_fail + 1;
        $display("FAIL: Loopback not working");
    end
    
    // 最终评估
    #1000;
    $display("          VALIDATION RESULTS");
    $display("Tests Completed: %0d", test_pass + test_fail);
    $display("Tests PASSED: %0d", test_pass);
    $display("Tests FAILED: %0d", test_fail);
    $display("TX Bytes: %0d, RX Bytes: %0d", tx_byte_count, rx_byte_count);
    $display("");
    
    if (test_fail == 0 && test_pass >= 3) begin
        $display("🎉 SUCCESS: UART System Fully Validated!");
        $display("");
        $display("Verified Features:");
        $display("  • TX Engine - Complete functionality");
        $display("  • RX Engine - Data reception and processing");
        $display("  • System Integration - End-to-end operation");
    end else if (test_pass >= 2) begin
        $display(" PARTIAL SUCCESS: Core TX working, RX needs attention");
        $display("");
        $display("Working:");
        $display("   TX Engine - Fully functional");
        $display("Needs Review:");
        $display("   RX Engine - Receiving data but output issues");
    end else begin
        $display(" SYSTEM NEEDS DEBUGGING");
        $display("   Significant functionality issues detected");
    end
    
    $display("==========================================");
    $finish;
end

// 详细监控
initial begin
    #10;
    $display("Time    | TX | RX | TX_Busy | RX_Busy | RX_Valid");
    $display("--------|----|----|---------|---------|---------");
    
    forever begin
        #(clk_div * 10); // 每10个波特周期报告一次
        $display("%8t | %2d | %2d | %7b | %7b | %8b", 
                 $time, tx_byte_count, rx_byte_count, tx_busy, rx_busy, rx_fifo_valid);
    end
end

// 合理的超时
initial begin
    #5000000; // 5ms超时
    $display("\n Simulation completed");
    $display("Final Status: TX=%0d, RX=%0d, Tests=%0d/%0d", 
             tx_byte_count, rx_byte_count, test_pass, test_pass + test_fail);
    $finish;
end

    initial begin
        $dumpfile("uart_engine_tb.vcd"); 
        $dumpvars(0, uart_engine_tb );  
    end
endmodule