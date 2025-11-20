`timescale 1ns / 1ps

module spi_engine (
    input wire clk,
    input wire rst_n,

    // config register
    input wire [31:0] clk_div,
    input wire        spi_enable,
    input wire [ 1:0] spi_mode,
    input wire        spi_msb_first,

    // fifo transmit 
    input  wire [7:0] tx_fifo_data,
    input  wire       tx_fifo_wr_en,
    input  wire       tx_start_pulse,
    output wire       tx_fifo_full,
    output wire       tx_busy,
    
    // fifo receive 
    output wire [7:0] rx_fifo_data,
    input  wire       rx_fifo_rd_en,
    input  wire       rx_start_pulse,
    output wire       rx_fifo_empty,
    output wire       rx_data_ready,

    // physics pin
    output reg  spi_sck,
    output reg  spi_mosi,
    input  wire spi_miso,
    output reg  spi_cs,

    // state register
    output reg         spi_mosi_oe,
    output wire        spi_busy,
    output wire [15:0] spi_tx_count,
    output wire [15:0] spi_rx_count,
    
    // fifo状态指示
    output wire [10:0] tx_fifo_data_count,
    output wire [10:0] rx_fifo_data_count
);

  // FIFO深度参数
  localparam FIFO_DEPTH = 1024;
  localparam ADDR_WIDTH = 10;

  // fsm state define
  localparam [1:0] IDLE     = 2'b00;
  localparam [1:0] ACTIVE   = 2'b01;
  localparam [1:0] COMPLETE = 2'b10;

  // internal registers
  reg [1:0] state;
  reg [7:0] tx_shift_reg;
  reg [7:0] rx_shift_reg;
  reg [3:0] bit_counter;
  reg [31:0] clk_counter;
  reg tx_fifo_rd_en;
  reg rx_fifo_wr_en;
  reg [7:0] rx_data_reg;
  reg [15:0] tx_byte_counter;
  reg [15:0] rx_byte_counter;
  reg tx_fifo_rd_en_reg;
  // 控制标志
  reg tx_active;

  // FIFO signals
  wire [7:0] tx_fifo_rd_data;
  wire tx_fifo_empty;
  
  wire rx_fifo_full;

  // spi mode configuration
  wire cpol = spi_mode[1];
  wire cpha = spi_mode[0];

  // 边沿检测
  reg tx_start_pulse_prev;
  reg rx_fifo_rd_en_prev;
  reg tx_fifo_wr_en_prev;
  
  always @(posedge clk or negedge rst_n) begin
    if (!rst_n) begin
      tx_start_pulse_prev <= 1'b0;
      rx_fifo_rd_en_prev  <= 1'b0;
      tx_start_pulse_prev <= 1'b0;
    end else begin
      tx_start_pulse_prev <= tx_start_pulse;
      rx_fifo_rd_en_prev  <= rx_fifo_rd_en;
      tx_fifo_wr_en_prev  <= tx_fifo_wr_en;
    end
  end

  wire tx_start_pulse_rise = tx_start_pulse && !tx_start_pulse_prev;
  wire tx_fifo_wr_en_rise = tx_fifo_wr_en && !tx_fifo_wr_en_prev;
  wire rx_fifo_rd_en_rise = rx_fifo_rd_en && !rx_fifo_rd_en_prev;

  // TX FIFO例化
  bram_fifo #(
    .DATA_WIDTH(8),
    .FIFO_DEPTH(FIFO_DEPTH)
  ) tx_fifo_inst (
    .clk(clk),
    .rst_n(rst_n),
    .wr_data(tx_fifo_data),
    .wr_en(tx_fifo_wr_en_rise),
    .full(tx_fifo_full),
    .rd_data(tx_fifo_rd_data),
    .rd_en(tx_fifo_rd_en),
    .empty(tx_fifo_empty),
    .data_count(tx_fifo_data_count)
  );

  // RX FIFO例化
  bram_fifo #(
    .DATA_WIDTH(8),
    .FIFO_DEPTH(FIFO_DEPTH)
  ) rx_fifo_inst (
    .clk(clk),
    .rst_n(rst_n),
    .wr_data(rx_data_reg),
    .wr_en(rx_fifo_wr_en),
    .full(rx_fifo_full),
    .rd_data(rx_fifo_data),
    .rd_en(rx_fifo_rd_en_rise),
    .empty(rx_fifo_empty),
    .data_count(rx_fifo_data_count)
  );

  // 控制逻辑
  always @(posedge clk or negedge rst_n) begin
    if (!rst_n) begin
      tx_active <= 1'b0;
    end else begin
      if (tx_start_pulse_rise) begin
        tx_active <= 1'b1;
      end else if (state == IDLE && tx_fifo_empty) begin
        tx_active <= 1'b0;
      end
    end
  end

always @(posedge clk or negedge rst_n) begin
    if(!rst_n)
        spi_sck <= cpol;
    else begin
        case (state)
        IDLE:
            spi_sck <= cpol;
        ACTIVE: begin
        if (clk_counter < (clk_div >> 1)) begin
            spi_sck <= cpol;
          end else begin
            spi_sck <= ~cpol;
          end
        end
        COMPLETE:
            spi_sck <= cpol;
        endcase
    end
end

    always @(posedge clk or negedge rst_n) begin
        if(!rst_n) 
            tx_fifo_rd_en_reg <= 1'b0;
        else 
            tx_fifo_rd_en_reg <= tx_fifo_rd_en;
    end

// 时钟计数器
    always @(posedge clk or negedge rst_n) begin
        if(!rst_n)
            clk_counter <= 0;
        else if(state==ACTIVE) begin
          if (clk_counter < clk_div) begin
            clk_counter <= clk_counter + 1;
          end else begin
            clk_counter <= 0;
          end
        end 
        else
            clk_counter <= 0;
    end

  // SPI状态机
  always @(posedge clk or negedge rst_n) begin
    if (!rst_n) begin
      state <= IDLE;
      spi_cs <= 1'b1;
      spi_mosi <= 1'b0;
      spi_mosi_oe <= 1'b0;
      tx_fifo_rd_en <= 1'b0;
      rx_fifo_wr_en <= 1'b0;
      bit_counter <= 0;
      tx_shift_reg <= 8'h00;
      rx_shift_reg <= 8'h00;
      rx_data_reg <= 8'h00;
      tx_byte_counter <= 0;
      rx_byte_counter <= 0;
    end else begin
      case (state)
        IDLE: begin
          if (!tx_fifo_empty && spi_enable && tx_active) begin
            state <= ACTIVE;
            spi_cs <= 1'b0;
            spi_mosi_oe <= 1'b1;
            tx_fifo_rd_en <= 1'b1;
          end
        end

        ACTIVE: begin
            tx_fifo_rd_en <= 1'b0;
          if (tx_fifo_rd_en_reg) begin
            tx_shift_reg <= tx_fifo_rd_data;
            tx_byte_counter <= tx_byte_counter + 1;
           
            // 立即设置第一位数据 - 对于CPHA=0模式
            if (cpha == 1'b0) begin
              if (spi_msb_first) begin
                spi_mosi <= tx_fifo_rd_data[7];
              end else begin
                spi_mosi <= tx_fifo_rd_data[0];
              end
            end
          end

if (cpha == 1'b0) begin
    // SPI模式0 , 2: CPHA=0 第一个边沿采样MISO, 第二个边沿移位MOSI

    if (clk_counter == (clk_div >> 1)) begin
        if (spi_msb_first) begin
            rx_shift_reg <= {rx_shift_reg[6:0], spi_miso};
        end else begin
            rx_shift_reg <= {spi_miso, rx_shift_reg[7:1]};
        end
    end

    if (clk_counter == clk_div) begin
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
            rx_data_reg <= rx_shift_reg; 
            rx_fifo_wr_en <= 1'b1;
            bit_counter <= 0;
        end
    end
end else begin
              // SPI模式1 ， 3： CPHA=1 第二个边沿采样MISO, 第一个边沿移位MOSI

              if (clk_counter == 0) begin
                if (bit_counter > 0) begin
                  if (spi_msb_first) begin
                    rx_shift_reg <= {rx_shift_reg[6:0], spi_miso};
                  end else begin
                    rx_shift_reg <= {spi_miso, rx_shift_reg[7:1]};
                  end
                end
              end

              if (clk_counter == (clk_div >> 1)) begin
                if (bit_counter == 0) begin
                  if (spi_msb_first) begin
                    spi_mosi <= tx_shift_reg[7];
                  end else begin
                    spi_mosi <= tx_shift_reg[0];
                  end
                  bit_counter <= bit_counter + 1;
                end else if (bit_counter < 8) begin
                  if (spi_msb_first) begin
                    tx_shift_reg <= {tx_shift_reg[6:0], 1'b0};
                    spi_mosi <= tx_shift_reg[6];
                  end else begin
                    tx_shift_reg <= {1'b0, tx_shift_reg[7:1]};
                    spi_mosi <= tx_shift_reg[1];
                  end
                    bit_counter <= bit_counter + 1;
                end else begin
                  // bit_counter == 8，所有8个bit已完成传输和采样
                  state <= COMPLETE;
                  rx_data_reg <= rx_shift_reg;
                  rx_fifo_wr_en <= 1'b1;
                  bit_counter <= 0;
                end
              end
            end
        end

        COMPLETE: begin
          if (rx_fifo_wr_en) begin
            rx_byte_counter <= rx_byte_counter + 1;
            rx_fifo_wr_en <= 1'b0;
          end
          // 决定下一个状态
          if (!tx_fifo_empty && spi_enable && tx_active) begin
            // 继续传输下一个字节
            state <= ACTIVE;
            tx_fifo_rd_en <= 1'b1;
          end else begin
            // 返回空闲状态
            state <= IDLE;
            spi_cs <= 1'b1;
            spi_mosi_oe <= 1'b0;
          end
        end
        default: begin
          state <= IDLE;
        end
      endcase
    end
  end

  assign tx_busy = (state != IDLE);
  assign spi_busy = (state != IDLE);
  assign spi_tx_count = tx_byte_counter;
  assign spi_rx_count = rx_byte_counter;
  assign rx_data_ready = !rx_fifo_empty;

endmodule