module i2c_engine (
    input wire        clk,
    input wire        rst_n,
    input wire [31:0] clk_div,

    // fifo transmit
    input  wire [7:0] tx_fifo_data,
    input  wire       tx_fifo_valid,
    output wire       tx_fifo_ready,

    //fifo receive
    output wire [7:0] rx_fifo_data,
    output wire       rx_fifo_valid,
    input  wire       rx_fifo_ready,

    // config register
    input wire       i2c_enable,
    input wire       i2c_master_mode,
    input wire       i2c_10bit_addr,
    input wire [9:0] i2c_dev_addr,
    input wire       i2c_restart,
    input wire [7:0] i2c_tx_count,
    input wire [7:0] i2c_rx_count,
    input wire       i2c_start,

    // physics pin
    output wire i2c_scl,
    inout  wire i2c_sda,

    // state reg
    output wire       i2c_busy,
    output wire       i2c_done,
    output wire       i2c_ack_error,
    output wire [7:0] i2c_tx_count_rem,
    output wire [7:0] i2c_rx_count_rem
);

  // fsm state define
  localparam [3:0]
    IDLE           = 4'd0,
    START          = 4'd1,
    TX_ADDR_FIRST  = 4'd2,  // 10位地址的第一个字节
  RX_ACK1 = 4'd3, TX_ADDR_SECOND = 4'd4,  // 10位地址的第二个字节（仅10位模式）
  RX_ACK2        = 4'd5,
    TX_DATA        = 4'd6,
    RX_ACK3        = 4'd7,
    RX_DATA        = 4'd8,
    TX_ACK         = 4'd9,
    RESTART        = 4'd10, // 重复起始条件（用于10位地址读操作）
  STOP = 4'd11;

  // Internal signals
  reg [ 3:0] state;
  reg [31:0] clk_counter;
  reg scl_oe, sda_oe;
  reg scl_out, sda_out;
  reg        sda_in;
  reg  [7:0] shift_reg;
  reg  [2:0] bit_counter;
  reg        ack_error;
  reg        done;
  reg        busy;
  reg  [7:0] tx_bytes_remaining;
  reg  [7:0] rx_bytes_remaining;
  reg        read_mode;
  reg  [9:0] dev_addr;  // 扩展到10位地址
  reg        data_loaded;
  reg        ten_bit_mode;
  reg        second_addr_byte;  // 标记是否在发送第二个地址字节
  reg        restart_pending;  // 标记是否需要重复起始条件

  // Clock divider
  wire       scl_pos_edge = (clk_counter == (clk_div >> 1));
  wire       scl_neg_edge = (clk_counter == 0);
  wire       clk_tick = (clk_counter == clk_div);

  always @(posedge clk or negedge rst_n) begin
    if (!rst_n) begin
      clk_counter <= 0;
    end else if (state != IDLE) begin
      if (clk_counter >= clk_div) begin
        clk_counter <= 0;
      end else begin
        clk_counter <= clk_counter + 1;
      end
    end else begin
      clk_counter <= 0;
    end
  end

  // Main State Machine with 10-bit address support
  always @(posedge clk or negedge rst_n) begin
    if (!rst_n) begin
      state <= IDLE;
      shift_reg <= 0;
      bit_counter <= 0;
      ack_error <= 0;
      done <= 0;
      busy <= 0;
      tx_bytes_remaining <= 0;
      rx_bytes_remaining <= 0;
      read_mode <= 0;
      dev_addr <= 0;
      data_loaded <= 0;
      ten_bit_mode <= 0;
      second_addr_byte <= 0;
      restart_pending <= 0;
    end else begin
      done <= 0;
      busy <= (state != IDLE);

      case (state)
        IDLE: begin
          if (i2c_start && i2c_enable) begin
            read_mode <= i2c_master_mode;
            dev_addr <= i2c_dev_addr;
            tx_bytes_remaining <= i2c_tx_count;
            rx_bytes_remaining <= i2c_rx_count;
            ten_bit_mode <= i2c_10bit_addr;
            data_loaded <= 0;
            second_addr_byte <= 0;
            restart_pending <= i2c_restart && i2c_10bit_addr && i2c_master_mode;

            // 准备第一个地址字节
            if (i2c_10bit_addr) begin
              // 10位地址模式：第一个字节是 11110 + A9A8 + W/R
              shift_reg <= {3'b111, i2c_dev_addr[9:8], 1'b0};  // 总是以写模式开始
            end else begin
              // 7位地址模式
              shift_reg <= {i2c_dev_addr[6:0], i2c_master_mode};
            end

            state <= START;
            bit_counter <= 0;
            ack_error <= 0;
          end
        end

        START: begin
          if (clk_tick) begin
            state <= TX_ADDR_FIRST;
          end
        end

        TX_ADDR_FIRST: begin
          if (clk_tick) begin
            if (bit_counter == 3'd7) begin
              state <= RX_ACK1;
              bit_counter <= 0;
            end else begin
              shift_reg   <= {shift_reg[6:0], 1'b0};
              bit_counter <= bit_counter + 3'd1;
            end
          end
        end

        RX_ACK1: begin
          if (scl_pos_edge) begin
            if (sda_in) begin
              ack_error <= 1;
              state <= STOP;
            end else begin
              if (ten_bit_mode && !second_addr_byte) begin
                // 10位地址模式：需要发送第二个地址字节
                state <= TX_ADDR_SECOND;
                shift_reg <= dev_addr[7:0];  // 发送地址的低8位
                bit_counter <= 0;
                second_addr_byte <= 1;
              end else begin
                // 7位地址模式或10位地址的第二个字节已完成
                if (read_mode) begin
                  // 读模式
                  if (ten_bit_mode && restart_pending) begin
                    // 10位地址读操作：需要重复起始条件
                    state <= RESTART;
                    restart_pending <= 0;
                  end else if (rx_bytes_remaining > 0) begin
                    state <= RX_DATA;
                    shift_reg <= 0;
                    bit_counter <= 0;
                  end else begin
                    state <= STOP;
                  end
                end else begin
                  // 写模式
                  if (tx_bytes_remaining > 0) begin
                    state <= TX_DATA;
                    bit_counter <= 0;
                    if (!data_loaded && tx_fifo_valid) begin
                      shift_reg   <= tx_fifo_data;
                      data_loaded <= 1;
                    end
                  end else begin
                    state <= STOP;
                  end
                end
              end
            end
          end
        end

        TX_ADDR_SECOND: begin
          if (clk_tick) begin
            if (bit_counter == 3'd7) begin
              state <= RX_ACK2;
              bit_counter <= 0;
            end else begin
              shift_reg   <= {shift_reg[6:0], 1'b0};
              bit_counter <= bit_counter + 3'd1;
            end
          end
        end

        RX_ACK2: begin
          if (scl_pos_edge) begin
            if (sda_in) begin
              ack_error <= 1;
              state <= STOP;
            end else begin
              if (read_mode && restart_pending) begin
                // 10位地址读操作：发送重复起始条件
                state <= RESTART;
              end else if (read_mode) begin
                // 读模式
                if (rx_bytes_remaining > 0) begin
                  state <= RX_DATA;
                  shift_reg <= 0;
                  bit_counter <= 0;
                end else begin
                  state <= STOP;
                end
              end else begin
                // 写模式
                if (tx_bytes_remaining > 0) begin
                  state <= TX_DATA;
                  bit_counter <= 0;
                  if (!data_loaded && tx_fifo_valid) begin
                    shift_reg   <= tx_fifo_data;
                    data_loaded <= 1;
                  end
                end else begin
                  state <= STOP;
                end
              end
            end
          end
        end

        RESTART: begin
          if (clk_tick) begin
            // 发送重复起始条件后，发送读命令
            state <= TX_ADDR_FIRST;
            shift_reg <= {3'b111, dev_addr[9:8], 1'b1};  // 读模式
            bit_counter <= 0;
            second_addr_byte <= 0;  // 不需要第二个地址字节
          end
        end

        TX_DATA: begin
          if (clk_tick) begin
            if (bit_counter == 3'd7) begin
              state <= RX_ACK3;
              bit_counter <= 0;
              if (tx_bytes_remaining > 0) begin
                tx_bytes_remaining <= tx_bytes_remaining - 8'd1;
              end
              data_loaded <= 0;
            end else begin
              shift_reg   <= {shift_reg[6:0], 1'b0};
              bit_counter <= bit_counter + 3'd1;
            end
          end
        end

        RX_ACK3: begin
          if (scl_pos_edge) begin
            if (sda_in) begin
              ack_error <= 1;
              state <= STOP;
            end else if (tx_bytes_remaining > 0) begin
              state <= TX_DATA;
              bit_counter <= 0;
              if (tx_fifo_valid && !data_loaded) begin
                shift_reg   <= tx_fifo_data;
                data_loaded <= 1;
              end
            end else begin
              state <= STOP;
            end
          end
        end

        RX_DATA: begin
          if (scl_pos_edge) begin
            shift_reg   <= {shift_reg[6:0], sda_in};
            bit_counter <= bit_counter + 3'd1;
            if (bit_counter == 3'd7) begin
              state <= TX_ACK;
              bit_counter <= 0;
            end
          end
        end

        TX_ACK: begin
          if (clk_tick) begin
            // Send ACK/NACK first, then decide next state
            if (rx_bytes_remaining > 1) begin
              // More data to read - send ACK and continue
              if (rx_bytes_remaining > 0) begin
                rx_bytes_remaining <= rx_bytes_remaining - 8'd1;
              end
              state <= RX_DATA;
              shift_reg <= 0;
              bit_counter <= 0;
            end else begin
              // Last byte - send NACK and stop
              if (rx_bytes_remaining > 0) begin
                rx_bytes_remaining <= rx_bytes_remaining - 8'd1;
              end
              state <= STOP;
            end
          end
        end

        STOP: begin
          if (clk_tick) begin
            state <= IDLE;
            done  <= 1;
          end
        end
      endcase
    end
  end

  // SDA input synchronization
  always @(posedge clk or negedge rst_n) begin
    if (!rst_n) begin
      sda_in <= 1;
    end else begin
      sda_in <= i2c_sda;
    end
  end

  // SCL control
  always @(posedge clk or negedge rst_n) begin
    if (!rst_n) begin
      scl_out <= 1;
      scl_oe  <= 0;
    end else begin
      case (state)
        IDLE: begin
          scl_out <= 1;
          scl_oe  <= 0;
        end
        START, STOP, RESTART: begin
          scl_out <= 1;
          scl_oe  <= 1;
        end
        default: begin
          scl_oe <= 1;
          if (clk_counter < (clk_div >> 1)) begin
            scl_out <= 0;
          end else begin
            scl_out <= 1;
          end
        end
      endcase
    end
  end

  // SDA control with 10-bit address support
  always @(posedge clk or negedge rst_n) begin
    if (!rst_n) begin
      sda_out <= 1;
      sda_oe  <= 0;
    end else begin
      case (state)
        IDLE: begin
          sda_out <= 1;
          sda_oe  <= 0;
        end
        START: begin
          sda_oe <= 1;
          if (clk_counter < (clk_div >> 2)) begin
            sda_out <= 1;
          end else begin
            sda_out <= 0;
          end
        end
        RESTART: begin
          sda_oe <= 1;
          if (clk_counter < (clk_div >> 2)) begin
            sda_out <= 1;  // 在SCL高电平时，SDA从低到高
          end else if (clk_counter < (clk_div >> 1)) begin
            sda_out <= 0;  // 然后从高到低
          end else begin
            sda_out <= 0;
          end
        end
        STOP: begin
          sda_oe <= 1;
          if (clk_counter < (clk_div >> 2)) begin
            sda_out <= 0;
          end else begin
            sda_out <= 1;
          end
        end
        TX_ADDR_FIRST, TX_ADDR_SECOND, TX_DATA: begin
          sda_oe  <= 1;
          sda_out <= shift_reg[7];
        end
        RX_ACK1, RX_ACK2, RX_ACK3, RX_DATA: begin
          sda_oe  <= 0;  // Release SDA for slave to drive
          sda_out <= 1;
        end
        TX_ACK: begin
          sda_oe  <= 1;
          // Send ACK (0) for all but last byte, NACK (1) for last byte
          sda_out <= (rx_bytes_remaining > 1) ? 1'b0 : 1'b1;
        end
        default: begin
          sda_oe  <= 0;
          sda_out <= 1;
        end
      endcase
    end
  end

  // TX FIFO control
  assign tx_fifo_ready = ((state == RX_ACK1 && !read_mode && !ten_bit_mode && tx_bytes_remaining > 0 && !data_loaded) || 
                       (state == RX_ACK2 && !read_mode && tx_bytes_remaining > 0 && !data_loaded) ||
                       (state == RX_ACK3 && tx_bytes_remaining > 0 && !data_loaded)) && 
                      !ack_error;

  // RX data capture with flow control
  reg [7:0] rx_data_reg;
  reg rx_valid_reg;

  always @(posedge clk or negedge rst_n) begin
    if (!rst_n) begin
      rx_data_reg  <= 0;
      rx_valid_reg <= 0;
    end else begin
      if (rx_valid_reg && rx_fifo_ready) begin
        rx_valid_reg <= 0;
      end

      if (state == RX_DATA && scl_pos_edge && bit_counter == 3'd7 && !rx_valid_reg) begin
        rx_data_reg  <= {shift_reg[6:0], sda_in};
        rx_valid_reg <= 1;
      end
    end
  end

  // Output assignments
  assign rx_fifo_data = rx_data_reg;
  assign rx_fifo_valid = rx_valid_reg;
  assign i2c_busy = busy;
  assign i2c_done = done;
  assign i2c_ack_error = ack_error;
  assign i2c_tx_count_rem = tx_bytes_remaining;
  assign i2c_rx_count_rem = rx_bytes_remaining;

  // Tri-state outputs
  assign i2c_scl = scl_oe ? scl_out : 1'bz;
  assign i2c_sda = sda_oe ? sda_out : 1'bz;

endmodule
