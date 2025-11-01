`timescale 1ns / 1ps

module uart_rx_engine_tb;

// Clock and Reset
reg clk;
reg rst_n;

// UART Configuration
reg [31:0] clk_div;
reg check_en;
reg [1:0] check_type;
reg [1:0] data_bit;
reg [1:0] stop_bit;

// UART Interface
reg uart_rx;
reg rx_ready;

// Outputs
wire [7:0] rx_data;
wire rx_valid;
wire rx_busy;
wire rx_error;
wire [15:0] rx_byte_count;

// Testbench variables
reg [7:0] test_data;
integer i;

// Instantiate UART RX Engine
uart_rx_engine uut (
    .clk(clk),
    .rst_n(rst_n),
    .clk_div(clk_div),
    .check_en(check_en),
    .check_type(check_type),
    .data_bit(data_bit),
    .stop_bit(stop_bit),
    .rx_data(rx_data),
    .rx_valid(rx_valid),
    .rx_ready(rx_ready),
    .uart_rx(uart_rx),
    .rx_busy(rx_busy),
    .rx_error(rx_error),
    .rx_byte_count(rx_byte_count)
);

// Clock generation (100MHz)
always #5 clk = ~clk;

// UART bit timing calculation
function integer get_bit_time;
    input [31:0] divisor;
    get_bit_time = divisor * 10; // 10 clock cycles per bit time for simulation
endfunction

// Task to send UART frame
task uart_send_frame;
    input [7:0] data;
    input enable_parity;
    input [1:0] parity_type;
    input [1:0] data_bits;
    input [1:0] stop_bits;
    
    integer bit_time;
    integer num_data_bits;
    reg parity_bit;
    begin
        bit_time = get_bit_time(clk_div);
        num_data_bits = (data_bits == 2'b00) ? 5 :
                       (data_bits == 2'b01) ? 6 :
                       (data_bits == 2'b10) ? 7 : 8;
        
        // Calculate parity
        if (enable_parity) begin
            case (parity_type)
                2'b00: parity_bit = ^data; // Even
                2'b01: parity_bit = ~^data; // Odd
                2'b10: parity_bit = 1'b1; // Mark
                2'b11: parity_bit = 1'b0; // Space
            endcase
        end
        
        // Send start bit
        uart_rx = 1'b0;
        #bit_time;
        
        // Send data bits (LSB first)
        for (i = 0; i < num_data_bits; i = i + 1) begin
            uart_rx = data[i];
            #bit_time;
        end
        
        // Send parity bit if enabled
        if (enable_parity) begin
            uart_rx = parity_bit;
            #bit_time;
        end
        
        // Send stop bit(s)
        uart_rx = 1'b1;
        case (stop_bits)
            2'b00: #bit_time; // 1 stop bit
            2'b01: #(bit_time * 1.5); // 1.5 stop bits
            2'b10: #(bit_time * 2); // 2 stop bits
            default: #bit_time;
        endcase
    end
endtask

initial begin
    // Initialize
    clk = 0;
    rst_n = 0;
    uart_rx = 1;
    rx_ready = 1;
    clk_div = 868; // 115200 baud @ 100MHz
    check_en = 0;
    check_type = 0;
    data_bit = 2'b11; // 8 data bits
    stop_bit = 2'b00; // 1 stop bit
    
    // Apply reset
    #100;
    rst_n = 1;
    #100;
    
    $display("=== UART RX Engine Testbench ===");
    
    // Test 1: Basic 8N1 reception
    $display("Test 1: Basic 8N1 reception");
    test_data = 8'h55;
    uart_send_frame(test_data, 0, 0, 2'b11, 2'b00);
    #1000;
    
    // Test 2: Different data patterns
    $display("Test 2: Various data patterns");
    for (i = 0; i < 4; i = i + 1) begin
        test_data = $random;
        uart_send_frame(test_data, 0, 0, 2'b11, 2'b00);
        #1000;
    end
    
    // Test 3: Even parity
    $display("Test 3: Even parity");
    check_en = 1;
    check_type = 2'b00;
    test_data = 8'hAA;
    uart_send_frame(test_data, 1, 2'b00, 2'b11, 2'b00);
    #1000;
    
    // Test 4: Odd parity
    $display("Test 4: Odd parity");
    check_type = 2'b01;
    test_data = 8'h55;
    uart_send_frame(test_data, 1, 2'b01, 2'b11, 2'b00);
    #1000;
    
    // Test 5: 7 data bits
    $display("Test 5: 7 data bits");
    check_en = 0;
    data_bit = 2'b10;
    test_data = 7'h55;
    uart_send_frame(test_data, 0, 0, 2'b10, 2'b00);
    #1000;
    
    // Test 6: 2 stop bits
    $display("Test 6: 2 stop bits");
    data_bit = 2'b11;
    stop_bit = 2'b10;
    test_data = 8'hFF;
    uart_send_frame(test_data, 0, 0, 2'b11, 2'b10);
    #1000;
    
    // Test 7: Back-to-back frames
    $display("Test 7: Back-to-back frames");
    stop_bit = 2'b00;
    for (i = 0; i < 3; i = i + 1) begin
        test_data = 8'h30 + i;
        uart_send_frame(test_data, 0, 0, 2'b11, 2'b00);
        #500;
    end
    
    // Test 8: rx_ready deassertion
    $display("Test 8: rx_ready flow control");
    rx_ready = 0;
    test_data = 8'h88;
    uart_send_frame(test_data, 0, 0, 2'b11, 2'b00);
    #2000;
    rx_ready = 1;
    #1000;
    
    $display("=== Simulation Complete ===");
    $finish;
end

// Monitor received data
always @(posedge clk) begin
    if (rx_valid) begin
        $display("Time: %0t, Received data: 0x%02h", $time, rx_data);
    end
    if (rx_error) begin
        $display("Time: %0t, RX Error detected", $time);
    end
end

initial begin
    $dumpfile("uart_rx_engine_tb.vcd");
    $dumpvars(0, uart_rx_engine_tb);
end
endmodule