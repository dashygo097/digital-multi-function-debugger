`timescale 1ns / 1ps

module uart_engine (
    input wire clk,
    input wire rst_n,

    // config register
    input wire [31:0] clk_div,     // uart_clk_div_counter
    input wire        check_en,    // 0 for close, 1 for open 
    input wire [ 1:0] check_type,  // 00 for even, 01 for odd, 10 for mark, 11 for space  
    input wire [ 1:0] data_bit,    // 00 for 5, 01 for 6, 10 for 7, 11 for 8
    input wire [ 1:0] stop_bit,    // 00 for 1, 01 for 1.5, 10 for 2

    // fifo transmit interface
    input  wire [7:0] tx_fifo_data,
    input  wire       tx_fifo_wr_en,    // 自动清零的脉冲写入信号
    input  wire       tx_start_pulse,   // 自动清零的脉冲启动发送信号
    output wire       tx_fifo_full,
    output wire       tx_busy,          // 发送进行中
    
    // fifo receive interface  
    output wire [7:0] rx_fifo_data,
    input  wire       rx_fifo_rd_en,    // 自动清零的脉冲读取信号
    input  wire       rx_start_pulse,   // 自动清零的脉冲启动读取信号
    output wire       rx_fifo_empty,
    output wire       rx_data_ready,    // RX FIFO中有数据可用

    // physics pin
    output wire uart_tx,
    input  wire uart_rx,

    // state register
    output wire        rx_busy,
    output wire        rx_error,
    output wire [15:0] tx_byte_count,
    output wire [15:0] rx_byte_count,
    
    // fifo状态指示
    output wire [10:0] tx_fifo_data_count,  // TX FIFO数据计数
    output wire [10:0] rx_fifo_data_count   // RX FIFO数据计数
);

    // 内部信号定义
    wire [7:0] tx_uart_data;
    wire       tx_uart_valid;
    wire       tx_uart_ready;
    
    wire [7:0] rx_uart_data;
    wire       rx_uart_valid;
    wire       rx_uart_ready;
    
    // 发送控制信号
    reg        tx_enable;
    reg        tx_wr_pulse;
    wire       tx_fifo_has_data;
    
    // 接收控制信号
    reg        rx_read_enable;
    reg        rx_rd_pulse;
    wire       rx_fifo_has_data;
    
    // 脉冲检测寄存器 - 用于上升沿检测
    reg tx_wr_en_delay;
    reg tx_start_pulse_delay;
    reg rx_rd_en_delay;
    reg rx_start_pulse_delay;

    // TX FIFO实例化
    bram_fifo #(
        .DATA_WIDTH(8),
        .FIFO_DEPTH(1024)
    ) tx_fifo_inst (
        .clk(clk),
        .rst_n(rst_n),
        
        // write interface (外部写入)
        .wr_data(tx_fifo_data),
        .wr_en(tx_wr_pulse),            // 使用内部生成的脉冲
        .full(tx_fifo_full),
        
        // read interface (UART发送引擎读取)
        .rd_data(tx_uart_data),
        .rd_en(tx_uart_ready & tx_enable & tx_fifo_has_data),
        .empty(tx_fifo_empty),
        
        // data count
        .data_count(tx_fifo_data_count)
    );
    
    // RX FIFO实例化
    bram_fifo #(
        .DATA_WIDTH(8),
        .FIFO_DEPTH(1024)
    ) rx_fifo_inst (
        .clk(clk),
        .rst_n(rst_n),
        
        // write interface (UART接收引擎写入)
        .wr_data(rx_uart_data),
        .wr_en(rx_uart_valid & ~rx_fifo_full),
        .full(rx_fifo_full),
        
        // read interface (外部读取)
        .rd_data(rx_fifo_data),
        .rd_en(rx_rd_pulse | (rx_read_enable & rx_fifo_has_data)),
        .empty(rx_fifo_empty),
        
        // data count
        .data_count(rx_fifo_data_count)
    );

    // 发送控制逻辑 - 脉冲检测和自动清零
    assign tx_fifo_has_data = ~tx_fifo_empty;
    
    // TX写入脉冲检测
    always @(posedge clk or negedge rst_n) begin
        if (!rst_n) begin
            tx_wr_en_delay <= 1'b0;
            tx_wr_pulse <= 1'b0;
        end else begin
            tx_wr_en_delay <= tx_fifo_wr_en;
            // 检测上升沿并生成单周期脉冲
            tx_wr_pulse <= tx_fifo_wr_en && !tx_wr_en_delay;
        end
    end
    
    // TX启动脉冲检测和控制
    always @(posedge clk or negedge rst_n) begin
        if (!rst_n) begin
            tx_enable <= 1'b0;
            tx_start_pulse_delay <= 1'b0;
        end else begin
            tx_start_pulse_delay <= tx_start_pulse;
            
            // 检测上升沿启动发送
            if (tx_start_pulse && !tx_start_pulse_delay) begin
                tx_enable <= 1'b1;
            end
            // 当FIFO为空且UART空闲时自动停止发送
            else if (tx_fifo_empty && !tx_busy) begin
                tx_enable <= 1'b0;
            end
        end
    end

    // 接收控制逻辑 - 脉冲检测和自动清零
    assign rx_fifo_has_data = ~rx_fifo_empty;
    assign rx_data_ready = rx_fifo_has_data;
    
    // RX读取脉冲检测
    always @(posedge clk or negedge rst_n) begin
        if (!rst_n) begin
            rx_rd_en_delay <= 1'b0;
            rx_rd_pulse <= 1'b0;
        end else begin
            rx_rd_en_delay <= rx_fifo_rd_en;
            // 检测上升沿并生成单周期脉冲
            rx_rd_pulse <= rx_fifo_rd_en && !rx_rd_en_delay;
        end
    end
    
    // RX启动脉冲检测和控制
    always @(posedge clk or negedge rst_n) begin
        if (!rst_n) begin
            rx_read_enable <= 1'b0;
            rx_start_pulse_delay <= 1'b0;
        end else begin
            rx_start_pulse_delay <= rx_start_pulse;
            
            // 检测上升沿启动连续读取
            if (rx_start_pulse && !rx_start_pulse_delay) begin
                rx_read_enable <= 1'b1;
            end
            // 当FIFO为空时自动停止连续读取
            else if (rx_fifo_empty) begin
                rx_read_enable <= 1'b0;
            end
        end
    end

    // UART TX模块
    uart_tx_engine uart_tx_engine (
        .clk(clk),
        .rst_n(rst_n),
        .clk_div(clk_div),
        .tx_data(tx_uart_data),
        .tx_valid(tx_enable & tx_fifo_has_data),
        .check_en(check_en),
        .check_type(check_type),
        .data_bit(data_bit),
        .stop_bit(stop_bit),
        .tx_ready(tx_uart_ready),
        .uart_tx(uart_tx),
        .tx_busy(tx_busy),
        .tx_byte_count(tx_byte_count)
    );

    // UART RX模块
    uart_rx_engine uart_rx_engine (
        .clk(clk),
        .rst_n(rst_n),
        .clk_div(clk_div),
        .check_en(check_en),
        .check_type(check_type),
        .data_bit(data_bit),
        .stop_bit(stop_bit),
        .rx_data(rx_uart_data),
        .rx_valid(rx_uart_valid),
        .rx_ready(~rx_fifo_full),
        .uart_rx(uart_rx),
        .rx_busy(rx_busy),
        .rx_error(rx_error),
        .rx_byte_count(rx_byte_count)
    );

endmodule