`timescale 1ns / 1ps

module i2c_engine (
    input wire        clk,
    input wire        rst_n,
    input wire [31:0] clk_div,

    // fifo transmit 
    input  wire [7:0] tx_fifo_data,
    input  wire       tx_fifo_wr_en,    // 自动清零的脉冲写入信号
    input  wire       tx_start_pulse,   // 自动清零的脉冲启动发送信号
    output wire       tx_fifo_full,
    output wire       tx_busy,          // 发送进行中
    
    // fifo receive 
    output wire [7:0] rx_fifo_data,
    input  wire       rx_fifo_rd_en,    // 自动清零的脉冲读取信号
    input  wire       rx_start_pulse,   // 自动清零的脉冲启动读取信号
    output wire       rx_fifo_empty,
    output wire       rx_data_ready,    // RX FIFO中有数据可用

    // config register
    input wire       i2c_enable,
    input wire       i2c_master_mode,
    input wire       i2c_10bit_addr,
    input wire [9:0] i2c_dev_addr,
    input wire       i2c_restart,
    input wire [7:0] i2c_tx_count,
    input wire [7:0] i2c_rx_count,

    // physics pin
    output wire i2c_scl,
    inout  wire i2c_sda,

    // state reg
    output wire       i2c_busy,
    output wire       i2c_done,
    output wire       i2c_ack_error,
    output wire [7:0] i2c_tx_count_rem,
    output wire [7:0] i2c_rx_count_rem,
    
    // fifo状态指示
    output wire [10:0] tx_fifo_data_count,  // TX FIFO数据计数
    output wire [10:0] rx_fifo_data_count  // RX FIFO数据计数
);

  // FIFO参数定义
  localparam FIFO_DEPTH = 1024;
  localparam ADDR_WIDTH = 10;

  // FIFO接口信号
  wire [7:0] tx_fifo_rd_data;
  wire tx_fifo_rd_en;
  wire tx_fifo_empty;
  
  wire [7:0] rx_fifo_wr_data;
  wire rx_fifo_wr_en;
  wire rx_fifo_full;

  // 脉冲检测寄存器
  reg tx_fifo_wr_en_dly;
  reg tx_start_pulse_dly;
  reg rx_fifo_rd_en_dly;
  reg rx_start_pulse_dly;
  
  // 边沿检测信号
  wire tx_fifo_wr_en_edge;
  wire tx_start_pulse_edge;
  wire rx_fifo_rd_en_edge;
  wire rx_start_pulse_edge;
  
  // 连续读取控制
  reg rx_continuous_read;
  reg [7:0] rx_read_count;
  reg [7:0] rx_read_target;

  // FSM状态定义
  localparam [3:0]
    IDLE           = 4'd0,
    START          = 4'd1,
    TX_ADDR_FIRST  = 4'd2,
    RX_ACK1        = 4'd3,
    TX_ADDR_SECOND = 4'd4,
    RX_ACK2        = 4'd5,
    TX_DATA        = 4'd6,
    RX_ACK3        = 4'd7,
    RX_DATA        = 4'd8,
    TX_ACK         = 4'd9,
    RESTART        = 4'd10,
    STOP           = 4'd11;

  // Internal signals
  reg [3:0] state;
  reg [31:0] clk_counter;
  reg scl_oe, sda_oe;
  reg scl_out, sda_out;
  reg sda_in;
  reg [7:0] shift_reg;
  reg [2:0] bit_counter;
  reg ack_error;
  reg done;
  reg busy;
  reg [7:0] tx_bytes_remaining;
  reg [7:0] rx_bytes_remaining;
  reg read_mode;
  reg [9:0] dev_addr;
  reg data_loaded;
  reg ten_bit_mode;
  reg second_addr_byte;
  reg restart_pending;

  // 时钟分频
  wire scl_pos_edge = (clk_counter == (clk_div >> 1));
  wire scl_neg_edge = (clk_counter == 0);
  wire clk_tick = (clk_counter == clk_div);

  // SDA输入同步寄存器
  reg [1:0] sda_sync;

  // 脉冲边沿检测
  always @(posedge clk or negedge rst_n) begin
    if (!rst_n) begin
      tx_fifo_wr_en_dly <= 0;
      tx_start_pulse_dly <= 0;
      rx_fifo_rd_en_dly <= 0;
      rx_start_pulse_dly <= 0;
      sda_sync <= 2'b11;
    end else begin
      tx_fifo_wr_en_dly <= tx_fifo_wr_en;
      tx_start_pulse_dly <= tx_start_pulse;
      rx_fifo_rd_en_dly <= rx_fifo_rd_en;
      rx_start_pulse_dly <= rx_start_pulse;
      sda_sync <= {sda_sync[0], i2c_sda}; // SDA输入同步
    end
  end

  assign tx_fifo_wr_en_edge = tx_fifo_wr_en && !tx_fifo_wr_en_dly;
  assign tx_start_pulse_edge = tx_start_pulse && !tx_start_pulse_dly;
  assign rx_fifo_rd_en_edge = rx_fifo_rd_en && !rx_fifo_rd_en_dly;
  assign rx_start_pulse_edge = rx_start_pulse && !rx_start_pulse_dly;

  // 连续读取控制逻辑 - 合并到一个always块中
  always @(posedge clk or negedge rst_n) begin
    if (!rst_n) begin
      rx_continuous_read <= 0;
      rx_read_count <= 0;
      rx_read_target <= 0;
    end else begin
      if (rx_start_pulse_edge) begin
        rx_continuous_read <= 1;
        rx_read_count <= 0;
        rx_read_target <= i2c_rx_count; // 使用配置的接收计数作为目标
      end else if (rx_continuous_read) begin
        if (rx_fifo_rd_en_edge) begin
          if (rx_read_count < rx_read_target) begin
            rx_read_count <= rx_read_count + 1;
          end
        end
        // 检查是否达到目标，如果达到则停止连续读取
        if (rx_read_count >= rx_read_target) begin
          rx_continuous_read <= 0;
        end
      end else begin
        rx_read_count <= 0; // 非连续读取模式时，计数器清零
      end
    end
  end

  // 时钟分频计数器
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

  // 主状态机
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
          if (tx_start_pulse_edge && i2c_enable) begin
            read_mode <= 0; // 写模式
            dev_addr <= i2c_dev_addr;
            tx_bytes_remaining <= i2c_tx_count;
            rx_bytes_remaining <= 0;
            ten_bit_mode <= i2c_10bit_addr;
            data_loaded <= 0;
            second_addr_byte <= 0;
            restart_pending <= 0;

            if (i2c_10bit_addr) begin
              shift_reg <= {3'b111, i2c_dev_addr[9:8], 1'b0};
            end else begin
              shift_reg <= {i2c_dev_addr[6:0], 1'b0};
            end

            state <= START;
            bit_counter <= 0;
            ack_error <= 0;
          end else if (rx_start_pulse_edge && i2c_enable) begin
            read_mode <= 1; // 读模式
            dev_addr <= i2c_dev_addr;
            tx_bytes_remaining <= 0;
            rx_bytes_remaining <= i2c_rx_count;
            ten_bit_mode <= i2c_10bit_addr;
            data_loaded <= 0;
            second_addr_byte <= 0;
            restart_pending <= i2c_restart && i2c_10bit_addr;

            if (i2c_10bit_addr) begin
              shift_reg <= {3'b111, i2c_dev_addr[9:8], 1'b0};
            end else begin
              shift_reg <= {i2c_dev_addr[6:0], 1'b1};
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
                state <= TX_ADDR_SECOND;
                shift_reg <= dev_addr[7:0];
                bit_counter <= 0;
                second_addr_byte <= 1;
              end else begin
                if (read_mode) begin
                  if (ten_bit_mode && restart_pending) begin
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
                  // 写模式：检查是否有数据要发送
                  if (tx_bytes_remaining > 0) begin
                    state <= TX_DATA;
                    bit_counter <= 0;
                    data_loaded <= 0; // 准备加载数据
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
                state <= RESTART;
              end else if (read_mode) begin
                if (rx_bytes_remaining > 0) begin
                  state <= RX_DATA;
                  shift_reg <= 0;
                  bit_counter <= 0;
                end else begin
                  state <= STOP;
                end
              end else begin
                // 写模式：检查是否有数据要发送
                if (tx_bytes_remaining > 0) begin
                  state <= TX_DATA;
                  bit_counter <= 0;
                  data_loaded <= 0; // 准备加载数据
                end else begin
                  state <= STOP;
                end
              end
            end
          end
        end

        RESTART: begin
          if (clk_tick) begin
            state <= TX_ADDR_FIRST;
            shift_reg <= {3'b111, dev_addr[9:8], 1'b1};
            bit_counter <= 0;
            second_addr_byte <= 0;
          end
        end

TX_DATA: begin
  if (!data_loaded && !tx_fifo_empty) begin
    // 加载数据
    shift_reg <= tx_fifo_rd_data;
    data_loaded <= 1;
    bit_counter <= 0;
  end else if (data_loaded && clk_tick) begin
    // 在时钟节拍时移位数据
    if (bit_counter < 3'd7) begin
      shift_reg <= {shift_reg[6:0], 1'b0};
      bit_counter <= bit_counter + 3'd1;
    end else begin
      // 发送完一个字节
      state <= RX_ACK3;
      bit_counter <= 0;
      data_loaded <= 0;
      if (tx_bytes_remaining > 0) begin
        tx_bytes_remaining <= tx_bytes_remaining - 8'd1;
      end
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
              data_loaded <= 0; // 准备加载下一个数据
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
            if (rx_bytes_remaining > 1) begin
              if (rx_bytes_remaining > 0) begin
                rx_bytes_remaining <= rx_bytes_remaining - 8'd1;
              end
              state <= RX_DATA;
              shift_reg <= 0;
              bit_counter <= 0;
            end else begin
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
        
        default: begin
          state <= IDLE; // 安全保护
        end
      endcase
    end
  end

  // SDA输入同步 
  always @(posedge clk or negedge rst_n) begin
    if (!rst_n) begin
      sda_in <= 1;
    end else begin
      sda_in <= sda_sync[1]; // 使用同步后的SDA值
    end
  end

  // SCL控制
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

  // SDA控制 
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
            sda_out <= 1;
          end else if (clk_counter < (clk_div >> 1)) begin
            sda_out <= 0;
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
          sda_oe  <= 0;  // 完全释放总线
          sda_out <= 1;  // 内部输出保持确定值
        end
        TX_ACK: begin
          sda_oe  <= 1;
          sda_out <= (rx_bytes_remaining > 1) ? 1'b0 : 1'b1;
        end
        default: begin
          sda_oe  <= 0;
          sda_out <= 1;
        end
      endcase
    end
  end

  // TX FIFO控制
  assign tx_fifo_rd_en = (state == TX_DATA) && !data_loaded && !tx_fifo_empty;


  // RX数据捕获和FIFO写入
  reg [7:0] rx_data_reg;
  reg rx_valid_reg;
  reg [7:0] rx_data_pipeline [0:1];
  reg [1:0] valid_pipeline;

  always @(posedge clk or negedge rst_n) begin
    if (!rst_n) begin
      rx_data_reg <= 0;
      rx_valid_reg <= 0;
      rx_data_pipeline[0] <= 0;
      rx_data_pipeline[1] <= 0;
      valid_pipeline <= 0;
    end else begin
      // 捕获RX数据
      if (state == RX_DATA && scl_pos_edge && bit_counter == 3'd7) begin
        rx_data_reg <= {shift_reg[6:0], sda_in};
        rx_valid_reg <= 1;
      end else begin
        rx_valid_reg <= 0;
      end
      rx_data_pipeline[0] <= rx_data_reg;
      rx_data_pipeline[1] <= rx_data_pipeline[0];
      valid_pipeline <= {valid_pipeline[0], rx_valid_reg};
    end
  end

  // FIFO写入信号
  assign rx_fifo_wr_data = rx_data_pipeline[1];
  assign rx_fifo_wr_en = valid_pipeline[1];


  bram_fifo #(
    .DATA_WIDTH(8),
    .FIFO_DEPTH(FIFO_DEPTH)
  ) tx_fifo_inst (
    .clk(clk),
    .rst_n(rst_n),
    .wr_data(tx_fifo_data),
    .wr_en(tx_fifo_wr_en_edge),
    .full(tx_fifo_full),
    .rd_data(tx_fifo_rd_data),
    .rd_en(tx_fifo_rd_en),
    .empty(tx_fifo_empty),
    .data_count(tx_fifo_data_count)
  );

  bram_fifo #(
    .DATA_WIDTH(8),
    .FIFO_DEPTH(FIFO_DEPTH)
  ) rx_fifo_inst (
    .clk(clk),
    .rst_n(rst_n),
    .wr_data(rx_fifo_wr_data),
    .wr_en(rx_fifo_wr_en),
    .full(rx_fifo_full),
    .rd_data(rx_fifo_data),
    .rd_en(rx_fifo_rd_en_edge),
    .empty(rx_fifo_empty),
    .data_count(rx_fifo_data_count)
  );

  // 输出分配
  assign rx_data_ready = !rx_fifo_empty;
  assign tx_busy = busy && !read_mode;
  assign i2c_busy = busy;
  assign i2c_done = done;
  assign i2c_ack_error = ack_error;
  assign i2c_tx_count_rem = tx_bytes_remaining;
  assign i2c_rx_count_rem = rx_bytes_remaining;

  // 三态输出 - 确保在任何时刻都有确定的值
  assign i2c_scl = scl_oe ? scl_out : 1'bz;
  assign i2c_sda = sda_oe ? sda_out : 1'bz;

endmodule