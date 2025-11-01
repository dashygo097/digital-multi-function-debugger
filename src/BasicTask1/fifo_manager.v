// fifo_manager_complete.v - 修复计数器位宽问题
`timescale 1ns / 1ps

module fifo_manager (
    input  wire        clk,
    input  wire        rst_n,
    
    // 协议选择
    input  wire [2:0]  protocol_sel,
    
    // UART FIFO接口
    output wire [7:0]  uart_tx_data,
    output wire        uart_tx_valid,
    input  wire        uart_tx_ready,
    input  wire [7:0]  uart_rx_data,
    input  wire        uart_rx_valid,
    output wire        uart_rx_ready,
    
    // I2C FIFO接口
    output wire [7:0]  i2c_tx_data,
    output wire        i2c_tx_valid,
    input  wire        i2c_tx_ready,
    input  wire [7:0]  i2c_rx_data,
    input  wire        i2c_rx_valid,
    output wire        i2c_rx_ready,
    
    // SPI FIFO接口
    output wire [7:0]  spi_tx_data,
    output wire        spi_tx_valid,
    input  wire        spi_tx_ready,
    input  wire [7:0]  spi_rx_data,
    input  wire        spi_rx_valid,
    output wire        spi_rx_ready,
    
    /*// CAN FIFO接口
    output wire [7:0]  can_tx_data,
    output wire        can_tx_valid,
    input  wire        can_tx_ready,
    input  wire [7:0]  can_rx_data,
    input  wire        can_rx_valid,
    output wire        can_rx_ready,*/
    
    /*// PWM FIFO接口
    output wire [7:0]  pwm_tx_data,
    output wire        pwm_tx_valid,
    input  wire        pwm_tx_ready,
    input  wire [7:0]  pwm_rx_data,
    input  wire        pwm_rx_valid,
    output wire        pwm_rx_ready,*/
    
    // AXI寄存器接口
    input  wire [7:0]  wr_data,
    input  wire        wr_en,
    input  wire [3:0]  wr_fifo_sel,
    output wire [7:0]  rd_data,
    input  wire        rd_en,
    input  wire [3:0]  rd_fifo_sel
    
    /*// FIFO状态输出
    output wire [31:0] fifo_status_0,  // I2C/SPI/CAN/PWM状态
    output wire [31:0] fifo_status_1   // UART状态*/
);


// UART FIFO计数器 (13位，深度4096)
wire [12:0] uart_tx_count;
wire [12:0] uart_rx_count;

// I2C FIFO计数器 (12位，深度2048)  
wire [11:0] i2c_tx_count;
wire [11:0] i2c_rx_count;

// SPI FIFO计数器 (14位，深度8192)
wire [13:0] spi_tx_count;
wire [13:0] spi_rx_count;

/*// CAN FIFO计数器 (13位，深度4096)
wire [12:0] can_tx_count;
wire [12:0] can_rx_count;

// PWM FIFO计数器 (11位，深度1024)
wire [10:0]  pwm_tx_count;
wire [10:0]  pwm_rx_count;*/

// FIFO状态信号
wire uart_tx_full, uart_tx_empty;
wire uart_rx_full, uart_rx_empty;
wire i2c_tx_full, i2c_tx_empty;
wire i2c_rx_full, i2c_rx_empty;
wire spi_tx_full, spi_tx_empty;
wire spi_rx_full, spi_rx_empty;
/*wire can_tx_full, can_tx_empty;
wire can_rx_full, can_rx_empty;
wire pwm_tx_full, pwm_tx_empty;
wire pwm_rx_full, pwm_rx_empty;*/

// FIFO读数据信号
wire [7:0] uart_rx_rd_data;
wire [7:0] i2c_rx_rd_data;
wire [7:0] spi_rx_rd_data;
/*wire [7:0] can_rx_rd_data;
wire [7:0] pwm_rx_rd_data;*/

// FIFO实例化

// UART TX FIFO: 4KB (深度4096)
bram_fifo #(
    .DATA_WIDTH(8),
    .FIFO_DEPTH(4096)
) uart_tx_fifo (
    .clk(clk),
    .rst_n(rst_n),
    .wr_data(wr_data),
    .wr_en(wr_en && (wr_fifo_sel == 4'h0)),
    .full(uart_tx_full),
    .rd_data(uart_tx_data),
    .rd_en(uart_tx_ready && (protocol_sel == 3'h0)),
    .empty(uart_tx_empty),
    .data_count(uart_tx_count)
);

// UART RX FIFO: 4KB (深度4096)
bram_fifo #(
    .DATA_WIDTH(8),
    .FIFO_DEPTH(4096)
) uart_rx_fifo (
    .clk(clk),
    .rst_n(rst_n),
    .wr_data(uart_rx_data),
    .wr_en(uart_rx_valid && (protocol_sel == 3'h0)),
    .full(uart_rx_full),
    .rd_data(uart_rx_rd_data),
    .rd_en(rd_en && (rd_fifo_sel == 4'h0)),
    .empty(uart_rx_empty),
    .data_count(uart_rx_count)
);

// I2C TX FIFO: 2KB (深度2048)
bram_fifo #(
    .DATA_WIDTH(8),
    .FIFO_DEPTH(2048)
) i2c_tx_fifo (
    .clk(clk),
    .rst_n(rst_n),
    .wr_data(wr_data),
    .wr_en(wr_en && (wr_fifo_sel == 4'h1)),
    .full(i2c_tx_full),
    .rd_data(i2c_tx_data),
    .rd_en(i2c_tx_ready && (protocol_sel == 3'h1)),
    .empty(i2c_tx_empty),
    .data_count(i2c_tx_count)
);

// I2C RX FIFO: 2KB (深度2048)
bram_fifo #(
    .DATA_WIDTH(8),
    .FIFO_DEPTH(2048)
) i2c_rx_fifo (
    .clk(clk),
    .rst_n(rst_n),
    .wr_data(i2c_rx_data),
    .wr_en(i2c_rx_valid && (protocol_sel == 3'h1)),
    .full(i2c_rx_full),
    .rd_data(i2c_rx_rd_data),
    .rd_en(rd_en && (rd_fifo_sel == 4'h1)),
    .empty(i2c_rx_empty),
    .data_count(i2c_rx_count)
);

// SPI TX FIFO: 8KB (深度8192)
bram_fifo #(
    .DATA_WIDTH(8),
    .FIFO_DEPTH(8192)
) spi_tx_fifo (
    .clk(clk),
    .rst_n(rst_n),
    .wr_data(wr_data),
    .wr_en(wr_en && (wr_fifo_sel == 4'h2)),
    .full(spi_tx_full),
    .rd_data(spi_tx_data),
    .rd_en(spi_tx_ready && (protocol_sel == 3'h2)),
    .empty(spi_tx_empty),
    .data_count(spi_tx_count)
);

// SPI RX FIFO: 8KB (深度8192)
bram_fifo #(
    .DATA_WIDTH(8),
    .FIFO_DEPTH(8192)
) spi_rx_fifo (
    .clk(clk),
    .rst_n(rst_n),
    .wr_data(spi_rx_data),
    .wr_en(spi_rx_valid && (protocol_sel == 3'h2)),
    .full(spi_rx_full),
    .rd_data(spi_rx_rd_data),
    .rd_en(rd_en && (rd_fifo_sel == 4'h2)),
    .empty(spi_rx_empty),
    .data_count(spi_rx_count)
);
/*
// CAN TX FIFO: 4KB (深度4096)
bram_fifo #(
    .DATA_WIDTH(8),
    .FIFO_DEPTH(4096)
) can_tx_fifo (
    .clk(clk),
    .rst_n(rst_n),
    .wr_data(wr_data),
    .wr_en(wr_en && (wr_fifo_sel == 4'h3)),
    .full(can_tx_full),
    .rd_data(can_tx_data),
    .rd_en(can_tx_ready && (protocol_sel == 3'h3)),
    .empty(can_tx_empty),
    .data_count(can_tx_count)
);

// CAN RX FIFO: 4KB (深度4096)
bram_fifo #(
    .DATA_WIDTH(8),
    .FIFO_DEPTH(4096)
) can_rx_fifo (
    .clk(clk),
    .rst_n(rst_n),
    .wr_data(can_rx_data),
    .wr_en(can_rx_valid && (protocol_sel == 3'h3)),
    .full(can_rx_full),
    .rd_data(can_rx_rd_data),
    .rd_en(rd_en && (rd_fifo_sel == 4'h3)),
    .empty(can_rx_empty),
    .data_count(can_rx_count)
);*/


// 读数据多路选择
assign rd_data = 
    (rd_fifo_sel == 4'h0) ? uart_rx_rd_data :
    (rd_fifo_sel == 4'h1) ? i2c_rx_rd_data :
    (rd_fifo_sel == 4'h2) ? spi_rx_rd_data :
    /*(rd_fifo_sel == 4'h3) ? can_rx_rd_data :
    (rd_fifo_sel == 4'h4) ? pwm_rx_rd_data :*/
    8'h00;

// FIFO控制信号
assign uart_tx_valid = ~uart_tx_empty && (protocol_sel == 3'h0);
assign uart_rx_ready = ~uart_rx_full && (protocol_sel == 3'h0);

assign i2c_tx_valid = ~i2c_tx_empty && (protocol_sel == 3'h1);
assign i2c_rx_ready = ~i2c_rx_full && (protocol_sel == 3'h1);

assign spi_tx_valid = ~spi_tx_empty && (protocol_sel == 3'h2);
assign spi_rx_ready = ~spi_rx_full && (protocol_sel == 3'h2);
/*
assign can_tx_valid = ~can_tx_empty && (protocol_sel == 3'h3);
assign can_rx_ready = ~can_rx_full && (protocol_sel == 3'h3);

assign pwm_tx_valid = ~pwm_tx_empty && (protocol_sel == 3'h4);
assign pwm_rx_ready = ~pwm_rx_full && (protocol_sel == 3'h4);*/

/*
// FIFO状态寄存器

// fifo_status_0: [31:28] PWM RX, [27:24] PWM TX, [23:20] CAN RX, [19:16] CAN TX
//               [15:12] SPI RX, [11:8] SPI TX, [7:4] I2C RX, [3:0] I2C TX
assign fifo_status_0 = {
    pwm_rx_count[3:0],    // 31:28 - PWM RX计数低4位
    pwm_tx_count[3:0],    // 27:24 - PWM TX计数低4位
    can_rx_count[3:0],    // 23:20 - CAN RX计数低4位
    can_tx_count[3:0],    // 19:16 - CAN TX计数低4位
    spi_rx_count[3:0],    // 15:12 - SPI RX计数低4位
    spi_tx_count[3:0],    // 11:8  - SPI TX计数低4位
    i2c_rx_count[3:0],    // 7:4   - I2C RX计数低4位
    i2c_tx_count[3:0]     // 3:0   - I2C TX计数低4位
};

// fifo_status_1: [27:16] UART RX FIFO计数, [15:0] UART TX FIFO计数
assign fifo_status_1 = {
    4'b0000,              // 31:28 - 保留
    uart_rx_count[11:0],  // 27:16 - UART RX计数 (12位)
    uart_tx_count[11:0]   // 15:0  - UART TX计数 (12位)
};
*/
endmodule