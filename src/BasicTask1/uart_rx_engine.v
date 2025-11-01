`timescale 1ns / 1ps

module uart_rx_engine (
    input  wire        clk,
    input  wire        rst_n,

    //config register
    input  wire [31:0] clk_div,
    input  wire        check_en,    //0 for close 1 for open 
    input  wire [1:0]  check_type,  //00 for even, 01 for odd, 10 for mark, 11 for space  
    input  wire [1:0]  data_bit,    //00 for 5, 01 for 6, 10 for 7, 11 for 8
    input  wire [1:0]  stop_bit,    //00 for 1, 01 for 1.5, 10 for 2
    
    //receive data
    output reg  [7:0]  rx_data,
    output reg         rx_valid,
    input  wire        rx_ready,
    
    //physics pin
    input  wire        uart_rx,
    
    //state register
    output reg         rx_busy,
    output reg         rx_error,
    output reg  [15:0] rx_byte_count
);

// fsm state define
localparam [2:0] IDLE        = 3'b000;
localparam [2:0] START       = 3'b001;
localparam [2:0] DATA        = 3'b010;
localparam [2:0] PARITY      = 3'b011;
localparam [2:0] STOP        = 3'b100;
localparam [2:0] WAIT_READY  = 3'b101;

reg [3:0]  state;
reg [7:0]  shift_reg;
reg [2:0]  bit_counter;
reg [31:0] baud_counter;
reg        uart_rx_sync1;
reg        uart_rx_sync2;
reg [7:0]  received_data;
reg        data_received;
reg        parity_error;
reg [3:0]  data_bits;
reg [31:0] stop_cnt;
reg        expected_parity;
reg        parity_received;

// 同步器消除亚稳态
always @(posedge clk or negedge rst_n) begin
    if (!rst_n) begin
        uart_rx_sync1 <= 1'b1;
        uart_rx_sync2 <= 1'b1;
    end else begin
        uart_rx_sync1 <= uart_rx;
        uart_rx_sync2 <= uart_rx_sync1;
    end
end

// 检测下降沿
wire rx_falling_edge = (uart_rx_sync2 == 1'b1) && (uart_rx_sync1 == 1'b0);

// 计算数据位数量
always @(*) begin
    case (data_bit)
        2'b00: data_bits = 4'd5;
        2'b01: data_bits = 4'd6;
        2'b10: data_bits = 4'd7;
        2'b11: data_bits = 4'd8;
        default: data_bits = 4'd8;
    endcase
end

// 计算停止位周期数
always @(*) begin
    case (stop_bit)
        2'b00: stop_cnt = clk_div;                    // 1 stop bit
        2'b01: stop_cnt = clk_div + (clk_div >> 1);   // 1.5 stop bits
        2'b10: stop_cnt = clk_div << 1;               // 2 stop bits
        default: stop_cnt = clk_div;                  // default 1 stop bit
    endcase
end

// 计算期望的奇偶校验位
function calc_parity;
    input [7:0] data;
    input [1:0] ctype;
    reg parity;
    begin
        parity = ^data; // Calculate even parity first
        case (ctype)
            2'b00: calc_parity = parity;        // Even parity
            2'b01: calc_parity = ~parity;       // Odd parity
            2'b10: calc_parity = 1'b1;          // Mark (always 1)
            2'b11: calc_parity = 1'b0;          // Space (always 0)
            default: calc_parity = parity;      // Default even
        endcase
    end
endfunction

always @(posedge clk or negedge rst_n) begin
    if (!rst_n) begin
        // reset
        state <= IDLE;
        rx_data <= 8'h00;
        rx_valid <= 1'b0;
        rx_busy <= 1'b0;
        rx_error <= 1'b0;
        baud_counter <= 0;
        bit_counter <= 0;
        shift_reg <= 8'h00;
        received_data <= 8'h00;
        rx_byte_count <= 0;
        data_received <= 1'b0;
        parity_error <= 1'b0;
        expected_parity <= 1'b0;
        parity_received <= 1'b0;
    end else begin
        // Default assignments
        rx_valid <= 1'b0;
        rx_error <= 1'b0;
        
        case (state)
            IDLE: begin
                rx_busy <= 1'b0;
                baud_counter <= 0;
                bit_counter <= 0;
                data_received <= 1'b0;
                parity_error <= 1'b0;
                
                if (rx_falling_edge) begin
                    rx_busy <= 1'b1;
                    state <= START;
                    baud_counter <= 0;
                end
            end
            
            START: begin
                // Wait for half bit period to sample at center of start bit
                if (baud_counter >= ((clk_div >> 1) - 1)) begin
                    // Verify start bit is still low
                    if (uart_rx_sync2 == 1'b0) begin
                        baud_counter <= 0;
                        state <= DATA;
                    end else begin
                        // False start bit
                        rx_error <= 1'b1;
                        state <= IDLE;
                    end
                end else begin
                    baud_counter <= baud_counter + 1;
                end
            end
            
            DATA: begin
                if (baud_counter >= (clk_div - 1)) begin
                    baud_counter <= 0;
                    // Sample data bit at full bit intervals - LSB FIRST
                    if (bit_counter < data_bits) begin
                        shift_reg[bit_counter] <= uart_rx_sync2; // LSB first
                    end
                    
                    if (bit_counter == (data_bits - 1)) begin
                        bit_counter <= 0;
                        if (check_en) begin
                            state <= PARITY;
                        end else begin
                            state <= STOP;
                        end
                    end else begin
                        bit_counter <= bit_counter + 1;
                    end
                end else begin
                    baud_counter <= baud_counter + 1;
                end
            end
            
            PARITY: begin
                if (baud_counter == (clk_div - 1)) begin
                    baud_counter <= 0;
                    // Sample parity bit
                    parity_received <= uart_rx_sync2;
                    
                    // Calculate expected parity
                    expected_parity <= calc_parity(shift_reg, check_type);
                    if (parity_received != expected_parity) begin
                        parity_error <= 1'b1;
                    end
                    
                    state <= STOP;
                end else begin
                    baud_counter <= baud_counter + 1;
                end
            end
            
            STOP: begin
                if (baud_counter == (stop_cnt - 1)) begin
                    baud_counter <= 0;
                    
                    // Check stop bit
                    if (uart_rx_sync2 == 1'b1) begin
                        // Valid stop bit
                        received_data <= shift_reg;
                        data_received <= 1'b1;
                        
                        if (parity_error) begin
                            rx_error <= 1'b1;
                            state <= IDLE;
                        end else if (rx_ready) begin
                            rx_data <= shift_reg;
                            rx_valid <= 1'b1;
                            rx_byte_count <= rx_byte_count + 1;
                            state <= IDLE;
                        end else begin
                            state <= WAIT_READY;
                        end
                    end else begin
                        // Framing error
                        rx_error <= 1'b1;
                        state <= IDLE;
                    end
                end else begin
                    baud_counter <= baud_counter + 1;
                end
            end
            
            WAIT_READY: begin
                if (rx_ready) begin
                    rx_data <= received_data;
                    rx_valid <= 1'b1;
                    rx_byte_count <= rx_byte_count + 1;
                    state <= IDLE;
                end
            end
            
            default: begin
                state <= IDLE;
            end
        endcase
    end
end

endmodule