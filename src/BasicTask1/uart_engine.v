`timescale 1ns / 1ps

module uart_engine (
    input  wire        clk,
    input  wire        rst_n,
    
    // config register
    input  wire [31:0] clk_div,       // uart_clk_div_counter
    input  wire        check_en,      // 0 for close, 1 for open 
    input  wire [1:0]  check_type,    // 00 for even, 01 for odd, 10 for mark, 11 for space  
    input  wire [1:0]  data_bit,      // 00 for 5, 01 for 6, 10 for 7, 11 for 8
    input  wire [1:0]  stop_bit,      // 00 for 1, 01 for 1.5, 10 for 2
    
    // fifo transmit
    input  wire [7:0]  tx_fifo_data,
    input  wire        tx_fifo_valid,
    output wire        tx_fifo_ready,
    
    // fifo receive  
    output wire [7:0]  rx_fifo_data,
    output wire        rx_fifo_valid,
    input  wire        rx_fifo_ready,
    
    // physics pin
    output wire        uart_tx,
    input  wire        uart_rx,
    
    // state register
    output wire        tx_busy,
    output wire        rx_busy,
    output wire        rx_error,
    output wire [15:0] tx_byte_count,
    output wire [15:0] rx_byte_count
);



// UART tx module
uart_tx_engine uart_tx_engine (
    .clk(clk),
    .rst_n(rst_n),
    .clk_div(clk_div),
    .tx_data(tx_fifo_data),
    .tx_valid(tx_fifo_valid),
    .check_en(check_en),
    .check_type(check_type),
    .data_bit(data_bit),
    .stop_bit(stop_bit),
    .tx_ready(tx_fifo_ready),
    .uart_tx(uart_tx),
    .tx_busy(tx_busy),
    .tx_byte_count(tx_byte_count)
);

// UART rx module  
uart_rx_engine uart_rx_engine (
    .clk(clk),
    .rst_n(rst_n),
    .clk_div(clk_div),
    .check_en(check_en),
    .check_type(check_type),
    .data_bit(data_bit),
    .stop_bit(stop_bit),
    .rx_data(rx_fifo_data),
    .rx_valid(rx_fifo_valid),
    .rx_ready(rx_fifo_ready),
    .uart_rx(uart_rx),
    .rx_busy(rx_busy),
    .rx_error(rx_error),
    .rx_byte_count(rx_byte_count)
);

endmodule