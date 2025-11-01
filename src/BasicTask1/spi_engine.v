`timescale 1ns / 1ps

module spi_engine (
    input wire clk,
    input wire rst_n,

    //config register
    input wire [31:0] clk_div,
    input wire        spi_enable,
    input wire [ 1:0] spi_mode,
    input wire        spi_msb_first,

    //fifo transmit
    input  wire [7:0] tx_fifo_data,
    input  wire       tx_fifo_valid,
    output wire       tx_fifo_ready,

    //fifo receive
    output wire [7:0] rx_fifo_data,
    output wire       rx_fifo_valid,
    input  wire       rx_fifo_ready,

    //physics pin
    output reg  spi_sck,
    output reg  spi_mosi,
    input  wire spi_miso,
    output reg  spi_cs,

    //state reg
    output reg         spi_mosi_oe,
    output wire        spi_busy,
    output wire [15:0] spi_tx_count,
    output wire [15:0] spi_rx_count
);

  // fsm state define
  localparam [2:0] IDLE = 3'b000;
  localparam [2:0] START = 3'b001;
  localparam [2:0] ACTIVE = 3'b010;
  localparam [2:0] COMPLETE = 3'b011;

  // internal registers
  reg [2:0] state;
  reg [7:0] tx_shift_reg;
  reg [7:0] rx_shift_reg;
  reg [2:0] bit_counter;
  reg [31:0] clk_counter;
  reg tx_fifo_rd_en;
  reg rx_fifo_wr_en;
  reg [7:0] rx_data_reg;
  reg [15:0] tx_byte_counter;
  reg [15:0] rx_byte_counter;

  // spi mode configuration
  wire cpol = spi_mode[1];
  wire cpha = spi_mode[0];

  // state machine
  always @(posedge clk or negedge rst_n) begin
    if (!rst_n) begin
      state <= IDLE;
      spi_sck <= cpol;
      spi_cs <= 1'b1;
      spi_mosi <= 1'b0;
      spi_mosi_oe <= 1'b0;
      tx_fifo_rd_en <= 1'b0;
      rx_fifo_wr_en <= 1'b0;
      clk_counter <= 0;
      bit_counter <= 0;
      tx_shift_reg <= 8'h00;
      rx_shift_reg <= 8'h00;
      rx_data_reg <= 8'h00;
      tx_byte_counter <= 0;
      rx_byte_counter <= 0;
    end else begin
      tx_fifo_rd_en <= 1'b0;
      rx_fifo_wr_en <= 1'b0;

      case (state)
        IDLE: begin
          spi_sck <= cpol;
          spi_cs <= 1'b1;
          spi_mosi <= 1'b0;
          spi_mosi_oe <= 1'b0;
          clk_counter <= 0;
          bit_counter <= 0;
          rx_shift_reg <= 8'h00;  // Reset RX shift register

          if (tx_fifo_valid && spi_enable) begin
            state <= START;
            tx_fifo_rd_en <= 1'b1;
            tx_shift_reg <= tx_fifo_data;
            tx_byte_counter <= tx_byte_counter + 1;
            spi_mosi_oe <= 1'b1;
          end
        end

        START: begin
          spi_cs <= 1'b0;
          spi_mosi_oe <= 1'b1;

          // Setup first data bit based on CPHA
          if (cpha == 1'b0) begin
            // CPHA=0: Setup data before first clock edge
            if (spi_msb_first) begin
              spi_mosi <= tx_shift_reg[7];
            end else begin
              spi_mosi <= tx_shift_reg[0];
            end
          end

          // Wait for half clock period for setup time
          if (clk_counter >= (clk_div >> 1)) begin
            clk_counter <= 0;
            state <= ACTIVE;

            if (cpha == 1'b1) begin
              // CPHA=1: Setup data after first clock edge setup
              if (spi_msb_first) begin
                spi_mosi <= tx_shift_reg[7];
              end else begin
                spi_mosi <= tx_shift_reg[0];
              end
            end
          end else begin
            clk_counter <= clk_counter + 1;
          end
        end

        ACTIVE: begin
          spi_cs <= 1'b0;
          spi_mosi_oe <= 1'b1;

          // Clock generation with proper CPHA handling
          if (clk_counter < (clk_div >> 1)) begin
            // First half of clock period
            spi_sck <= cpol ^ cpha;  // Adjust for CPHA
            clk_counter <= clk_counter + 1;

            // CPHA=1: Sample MISO at middle of first half
            if (cpha == 1'b1 && clk_counter == ((clk_div >> 2) - 1)) begin
              if (spi_msb_first) begin
                rx_shift_reg <= {rx_shift_reg[6:0], spi_miso};
              end else begin
                rx_shift_reg <= {spi_miso, rx_shift_reg[7:1]};
              end
            end
          end else if (clk_counter < clk_div) begin
            // Second half of clock period
            spi_sck <= ~cpol ^ cpha;  // Adjust for CPHA
            clk_counter <= clk_counter + 1;

            // CPHA=0: Sample MISO at middle of second half
            if (cpha == 1'b0 && clk_counter == ((clk_div >> 1) + (clk_div >> 2) - 1)) begin
              if (spi_msb_first) begin
                rx_shift_reg <= {rx_shift_reg[6:0], spi_miso};
              end else begin
                rx_shift_reg <= {spi_miso, rx_shift_reg[7:1]};
              end
            end

            // Setup next data bit at end of clock period
            if (clk_counter == clk_div - 1) begin
              if (bit_counter < 7) begin
                bit_counter <= bit_counter + 1;
                if (spi_msb_first) begin
                  tx_shift_reg <= {tx_shift_reg[6:0], 1'b0};
                  spi_mosi <= tx_shift_reg[6];
                end else begin
                  tx_shift_reg <= {1'b0, tx_shift_reg[7:1]};
                  spi_mosi <= tx_shift_reg[1];
                end
              end else begin
                state <= COMPLETE;
              end
            end
          end else begin
            clk_counter <= 0;
          end
        end

        COMPLETE: begin
          spi_sck <= cpol;
          rx_data_reg <= rx_shift_reg;
          rx_fifo_wr_en <= 1'b1;
          rx_byte_counter <= rx_byte_counter + 1;

          if (rx_fifo_ready) begin
            if (tx_fifo_valid && spi_enable) begin
              state <= START;
              tx_fifo_rd_en <= 1'b1;
              tx_shift_reg <= tx_fifo_data;
              tx_byte_counter <= tx_byte_counter + 1;
              // Reset RX shift register for new transmission
              rx_shift_reg <= 8'h00;
            end else begin
              state <= IDLE;
              spi_cs <= 1'b1;
              spi_mosi_oe <= 1'b0;
            end
          end
        end

        default: state <= IDLE;
      endcase
    end
  end

  assign tx_fifo_ready = (state == IDLE) || (state == COMPLETE && rx_fifo_ready && !tx_fifo_rd_en);
  assign rx_fifo_data = rx_data_reg;
  assign rx_fifo_valid = rx_fifo_wr_en;
  assign spi_busy = (state != IDLE);
  assign spi_tx_count = tx_byte_counter;
  assign spi_rx_count = rx_byte_counter;

endmodule
