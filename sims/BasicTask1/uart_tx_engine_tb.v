`timescale 1ns / 1ps

module uart_tx_engine_tb;

reg clk;
reg rst_n;
reg [31:0] clk_div;
reg [7:0] tx_data;
reg tx_valid;
reg check_en;
reg [1:0] check_type;
reg [1:0] data_bit;
reg [1:0] stop_bit;

wire tx_ready;
wire uart_tx;
wire tx_busy;
wire [15:0] tx_byte_count;

uart_tx_engine uut (
    .clk(clk),
    .rst_n(rst_n),
    .clk_div(clk_div),
    .tx_data(tx_data),
    .tx_valid(tx_valid),
    .check_en(check_en),
    .check_type(check_type),
    .data_bit(data_bit),
    .stop_bit(stop_bit),
    .tx_ready(tx_ready),
    .uart_tx(uart_tx),
    .tx_busy(tx_busy),
    .tx_byte_count(tx_byte_count)
);

always #5 clk = ~clk;

initial begin
    clk = 0;
    rst_n = 0;
    clk_div = 868;
    tx_data = 8'h00;
    tx_valid = 0;
    check_en = 0;
    check_type = 0;
    data_bit = 2'b11; // 8 data bits
    stop_bit = 2'b00; // 1 stop bit
    
    #100;
    rst_n = 1;
    #100;
    
    $display("=== Simple UART TX Test ===");
    
    // Test single byte
    $display("Test 1: Single byte 0x55");
    tx_data = 8'h55;
    tx_valid = 1;
    wait(tx_ready == 0);
    tx_valid = 0;
    wait(tx_busy == 0);
    $display("Test 1 completed");
    
    // Wait a bit before next test
    #10000;
    
    // Test continuous bytes with proper timing
    $display("Test 2: Continuous bytes");
    
    // First byte
    tx_data = 8'hAA;
    tx_valid = 1;
    wait(tx_ready == 0);
    tx_valid = 0;
    
    // Wait for first byte to complete
    wait(tx_ready == 1);
    #1000;
    
    // Second byte
    tx_data = 8'hF0;
    tx_valid = 1;
    wait(tx_ready == 0);
    tx_valid = 0;
    
    wait(tx_busy == 0);
    $display("Test 2 completed");
    
    $display("TX Bytes: %0d", tx_byte_count);
    $finish;
end

initial begin
    $monitor("Time: %0t, State: TX=%b, Busy=%b, Ready=%b", 
             $time, uart_tx, tx_busy, tx_ready);
end
initial begin
    $dumpfile("uart_tx_engine_tb.vcd");
    $dumpvars(0, uart_tx_engine_tb);
end
endmodule