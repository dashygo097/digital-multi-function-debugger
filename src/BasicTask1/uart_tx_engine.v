`timescale 1ns / 1ps

module uart_tx_engine (
    input wire clk,
    input wire rst_n,

    //config register
    input wire [31:0] clk_div,
    input wire        check_en,    //0 for close 1 for open 
    input wire [ 1:0] check_type,  //00 for even, 01 for odd, 10 for mark, 11 for space  
    input wire [ 1:0] data_bit,    //00 for 5, 01 for 6, 10 for 7, 11 for 8
    input wire [ 1:0] stop_bit,    //00 for 1, 01 for 1.5, 10 for 2

    //transmit data
    input  wire [7:0] tx_data,
    input  wire       tx_valid,
    output reg        tx_ready,

    //physics pin
    output reg uart_tx,

    //state register
    output reg        tx_busy,
    output reg [15:0] tx_byte_count
);

  // fsm state define
  localparam [2:0] IDLE = 3'b000;
  localparam [2:0] START = 3'b001;
  localparam [2:0] DATA = 3'b010;
  localparam [2:0] PARITY = 3'b011;
  localparam [2:0] STOP = 3'b100;

  reg [2:0] state;
  reg [2:0] next_state;
  reg [7:0] shift_reg;
  reg [2:0] bit_count;
  reg [31:0] baud_counter;
  reg parity_bit;

  // Data bits configuration
  wire [2:0] num_data_bits = (data_bit == 2'b00) ? 3'd4 :  // 5 bits (0-4)
  (data_bit == 2'b01) ? 3'd5 :  // 6 bits (0-5)  
  (data_bit == 2'b10) ? 3'd6 :  // 7 bits (0-6)
  3'd7;  // 8 bits (0-7)

  // Stop bit configuration  
  wire [31:0] stop_cycles = (stop_bit == 2'b00) ? clk_div :  // 1 stop bit
  (stop_bit == 2'b01) ? (clk_div * 3) / 2 :  // 1.5 stop bits
  (stop_bit == 2'b10) ? clk_div * 2 :  // 2 stop bits
  clk_div;  // default 1 stop bit

  // Calculate parity
  always @(*) begin
    if (check_en) begin
      case (check_type)
        2'b00:   parity_bit = ^shift_reg;  // Even parity
        2'b01:   parity_bit = ~(^shift_reg);  // Odd parity
        2'b10:   parity_bit = 1'b1;  // Mark
        2'b11:   parity_bit = 1'b0;  // Space
        default: parity_bit = ^shift_reg;
      endcase
    end else begin
      parity_bit = 1'b0;
    end
  end

  // State register
  always @(posedge clk or negedge rst_n) begin
    if (!rst_n) begin
      state <= IDLE;
    end else begin
      state <= next_state;
    end
  end

  // Next state logic
  always @(*) begin
    next_state = state;
    case (state)
      IDLE: begin
        if (tx_valid && tx_ready) begin
          next_state = START;
        end
      end
      START: begin
        if (baud_counter == clk_div - 1) begin
          next_state = DATA;
        end
      end
      DATA: begin
        if (baud_counter == clk_div - 1 && bit_count == num_data_bits) begin
          if (check_en) begin
            next_state = PARITY;
          end else begin
            next_state = STOP;
          end
        end
      end
      PARITY: begin
        if (baud_counter == clk_div - 1) begin
          next_state = STOP;
        end
      end
      STOP: begin
        if (baud_counter == stop_cycles - 1) begin
          next_state = IDLE;
        end
      end
    endcase
  end

  // Output logic and counters
  always @(posedge clk or negedge rst_n) begin
    if (!rst_n) begin
      uart_tx <= 1'b1;
      tx_ready <= 1'b1;
      tx_busy <= 1'b0;
      tx_byte_count <= 0;
      shift_reg <= 8'h00;
      bit_count <= 0;
      baud_counter <= 0;
    end else begin
      case (state)
        IDLE: begin
          uart_tx <= 1'b1;
          tx_busy <= 1'b0;
          bit_count <= 0;
          baud_counter <= 0;

          if (tx_valid && tx_ready) begin
            shift_reg <= tx_data;
            tx_ready  <= 1'b0;
            tx_busy   <= 1'b1;
          end else begin
            tx_ready <= 1'b1;
          end
        end

        START: begin
          uart_tx <= 1'b0;

          if (baud_counter == clk_div - 1) begin
            baud_counter <= 0;
          end else begin
            baud_counter <= baud_counter + 1;
          end
        end

        DATA: begin
          uart_tx <= shift_reg[bit_count];

          if (baud_counter == clk_div - 1) begin
            baud_counter <= 0;
            if (bit_count == num_data_bits) begin
              bit_count <= 0;
            end else begin
              bit_count <= bit_count + 1;
            end
          end else begin
            baud_counter <= baud_counter + 1;
          end
        end

        PARITY: begin
          uart_tx <= parity_bit;

          if (baud_counter == clk_div - 1) begin
            baud_counter <= 0;
          end else begin
            baud_counter <= baud_counter + 1;
          end
        end

        STOP: begin
          uart_tx <= 1'b1;

          if (baud_counter == stop_cycles - 1) begin
            baud_counter <= 0;
            tx_byte_count <= tx_byte_count + 1;
            tx_ready <= 1'b1;
          end else begin
            baud_counter <= baud_counter + 1;
          end
        end
      endcase
    end
  end

endmodule
