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
    input  wire       tx_fifo_wr_en,    // 脉冲写入FIFO（写入一字节）
    input  wire       tx_start_pulse,   // 脉冲启动SPI传输（发送FIFO中全部数据）
    output wire       tx_fifo_full,
    output wire       tx_busy,          // 发送进行中
    
    // fifo receive 
    output wire [7:0] rx_fifo_data,
    input  wire       rx_fifo_rd_en,    // 脉冲读取FIFO（读取一字节）
    input  wire       rx_start_pulse,   // 脉冲启动连续读取（读取全部数据）
    output wire       rx_fifo_empty,
    output wire       rx_data_ready,    // RX FIFO中有数据可用

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
    output wire [10:0] tx_fifo_data_count,  // TX FIFO数据计数
    output wire [10:0] rx_fifo_data_count   // RX FIFO数据计数
);

  // FIFO深度参数
  localparam FIFO_DEPTH = 1024;
  localparam ADDR_WIDTH = 10;

  // fsm state define
  localparam [2:0] IDLE = 3'b000;
  localparam [2:0] REQ_DATA = 3'b001;
  localparam [2:0] LOAD_DATA = 3'b010;
  localparam [2:0] START = 3'b011;
  localparam [2:0] ACTIVE = 3'b100;
  localparam [2:0] COMPLETE = 3'b101;

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
  
  // 控制标志
  reg tx_continuous_mode;
  reg rx_continuous_mode;

  // FIFO signals
  wire [7:0] tx_fifo_rd_data;
  wire tx_fifo_empty;
  wire tx_fifo_rd_en_actual;
  
  wire rx_fifo_full;
  wire rx_fifo_wr_en_actual;
  wire rx_fifo_rd_en_actual;

  // spi mode configuration
  wire cpol = spi_mode[1];
  wire cpha = spi_mode[0];

  // 边沿检测逻辑
  reg tx_fifo_wr_en_prev, tx_start_pulse_prev, rx_fifo_rd_en_prev, rx_start_pulse_prev;
  
  always @(posedge clk or negedge rst_n) begin
    if (!rst_n) begin
      tx_fifo_wr_en_prev <= 1'b0;
      tx_start_pulse_prev <= 1'b0;
      rx_fifo_rd_en_prev <= 1'b0;
      rx_start_pulse_prev <= 1'b0;
    end else begin
      // 正确的边沿检测：先保存当前值，然后在下个周期比较
      tx_fifo_wr_en_prev <= tx_fifo_wr_en;
      tx_start_pulse_prev <= tx_start_pulse;
      rx_fifo_rd_en_prev <= rx_fifo_rd_en;
      rx_start_pulse_prev <= rx_start_pulse;
    end
  end

  // 边沿检测信号
  wire tx_fifo_wr_en_rise = tx_fifo_wr_en && !tx_fifo_wr_en_prev;
  wire tx_start_pulse_rise = tx_start_pulse && !tx_start_pulse_prev;
  wire rx_fifo_rd_en_rise = rx_fifo_rd_en && !rx_fifo_rd_en_prev;
  wire rx_start_pulse_rise = rx_start_pulse && !rx_start_pulse_prev;

  // TX FIFO实例化
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
    .rd_en(tx_fifo_rd_en_actual),
    .empty(tx_fifo_empty),
    .data_count(tx_fifo_data_count)
  );

  // RX FIFO实例化
  bram_fifo #(
    .DATA_WIDTH(8),
    .FIFO_DEPTH(FIFO_DEPTH)
  ) rx_fifo_inst (
    .clk(clk),
    .rst_n(rst_n),
    .wr_data(rx_data_reg),
    .wr_en(rx_fifo_wr_en_actual),
    .full(rx_fifo_full),
    .rd_data(rx_fifo_data),
    .rd_en(rx_fifo_rd_en_actual),
    .empty(rx_fifo_empty),
    .data_count(rx_fifo_data_count)
  );

  // 控制逻辑
  always @(posedge clk or negedge rst_n) begin
    if (!rst_n) begin
      tx_continuous_mode <= 1'b0;
      rx_continuous_mode <= 1'b0;
    end else begin
      // TX启动脉冲：进入连续发送模式
      if (tx_start_pulse_rise) begin
        tx_continuous_mode <= 1'b1;
      end else if (state == IDLE && tx_fifo_empty) begin
        tx_continuous_mode <= 1'b0;
      end
      
      // RX启动脉冲：进入连续读取模式
      if (rx_start_pulse_rise) begin
        rx_continuous_mode <= 1'b1;
      end else if (rx_fifo_empty) begin
        rx_continuous_mode <= 1'b0;
      end
    end
  end

  // FIFO控制信号
  assign tx_fifo_rd_en_actual = tx_fifo_rd_en && !tx_fifo_empty;
  assign rx_fifo_wr_en_actual = rx_fifo_wr_en && !rx_fifo_full;
  
  //FIFO读使能检测信号
  assign rx_fifo_rd_en_actual = rx_fifo_rd_en_rise;

  //SPI状态机
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
      // 默认值
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
          rx_shift_reg <= 8'h00;

          if (!tx_fifo_empty && spi_enable && tx_continuous_mode) begin
            state <= REQ_DATA;
            tx_fifo_rd_en <= 1'b1;
          end
        end

        REQ_DATA: begin
          state <= LOAD_DATA;
          spi_cs <= 1'b0;
          spi_mosi_oe <= 1'b1;
        end

        LOAD_DATA: begin
          state <= START;
          tx_shift_reg <= tx_fifo_rd_data;
          tx_byte_counter <= tx_byte_counter + 16'ds1;
          
          // 设置第一位数据
          if (cpha == 1'b0) begin
            if (spi_msb_first) begin
              spi_mosi <= tx_fifo_rd_data[7];
            end else begin
              spi_mosi <= tx_fifo_rd_data[0];
            end
          end
        end

        START: begin
          spi_cs <= 1'b0;
          spi_mosi_oe <= 1'b1;

          if (clk_counter >= (clk_div >> 1)) begin
            clk_counter <= 0;
            state <= ACTIVE;

            if (cpha == 1'b1) begin
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

          if (clk_counter < (clk_div >> 1)) begin
            // First half of clock period
            spi_sck <= cpol ^ cpha;
            clk_counter <= clk_counter + 1;

            // CPHA=1: 在时钟前半段采样
            if (cpha == 1'b1) begin
              if (clk_counter == ((clk_div >> 2) - 1)) begin
                if (spi_msb_first) begin
                  rx_shift_reg <= {rx_shift_reg[6:0], spi_miso};
                end else begin
                  rx_shift_reg <= {spi_miso, rx_shift_reg[7:1]};
                end
              end
            end
          end else if (clk_counter < clk_div) begin
            // Second half of clock period
            spi_sck <= ~cpol ^ cpha;
            clk_counter <= clk_counter + 1;

            // CPHA=0: 在时钟后半段采样
            if (cpha == 1'b0) begin
              if (clk_counter == ((clk_div >> 1) + (clk_div >> 2) + 5)) begin
                if (spi_msb_first) begin
                  rx_shift_reg <= {rx_shift_reg[6:0], spi_miso};
                end else begin
                  rx_shift_reg <= {spi_miso, rx_shift_reg[7:1]};
                end
              end
            end

            // Setup next data bit at end of clock period
            if (clk_counter == clk_div - 1) begin
              if (bit_counter < 7) begin
                bit_counter <= bit_counter + 16'd1;
                if (spi_msb_first) begin
                  tx_shift_reg <= {tx_shift_reg[6:0], 1'b0};
                  spi_mosi <= tx_shift_reg[6];
                end else begin
                  tx_shift_reg <= {1'b0, tx_shift_reg[7:1]};
                  spi_mosi <= tx_shift_reg[1];
                end
              end else begin
                state <= COMPLETE;
                bit_counter <= 0;
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
          if (rx_fifo_wr_en_actual) begin
            rx_byte_counter <= rx_byte_counter + 16'd1;
          end
          // 准备下一个传输或返回IDLE
          if (!tx_fifo_empty && spi_enable && tx_continuous_mode) begin
            state <= REQ_DATA;
            tx_fifo_rd_en <= 1'b1;
            rx_shift_reg <= 8'h00;
          end else begin
            state <= IDLE;
            spi_cs <= 1'b1;
            spi_mosi_oe <= 1'b0;
          end
        end
        default: state <= IDLE;
      endcase
    end
  end

  assign tx_busy = (state != IDLE);
  assign spi_busy = (state != IDLE);
  assign spi_tx_count = tx_byte_counter;
  assign spi_rx_count = rx_byte_counter;
  assign rx_data_ready = !rx_fifo_empty;

endmodule