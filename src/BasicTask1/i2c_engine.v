`timescale 1ns / 1ps

module i2c_engine (
    input  wire        clk,
    input  wire        rst_n,
    input  wire [31:0] clk_div,

    // fifo transmit 
    input  wire [7:0]  tx_fifo_data,
    input  wire        tx_fifo_wr_en,   //wr data
    input  wire        tx_start_pulse,  //start iic wr
    output wire        tx_fifo_full,
    output wire        tx_busy,      

    // fifo receive 
    output wire [7:0]  rx_fifo_data,
    input  wire        rx_fifo_rd_en,   //rd data
    input  wire        rx_start_pulse,  //srart iic rd
    output wire        rx_fifo_empty,
    output wire        rx_data_ready,  

    // config register
    input  wire       i2c_enable,
    input  wire       i2c_master_mode,  
    input  wire       i2c_10bit_addr,
    input  wire [9:0] i2c_dev_addr,
    input  wire [15:0] i2c_reg_addr,
    input  wire       i2c_reg_addr_len,
    input  wire [7:0] i2c_tx_count,
    input  wire [7:0] i2c_rx_count,

    // physical pins (open-drain)
    output wire i2c_scl,
    inout  wire i2c_sda,

    // state reg
    output wire       i2c_busy,
    output wire       i2c_done,
    output wire       i2c_ack_error,
    output wire [7:0] i2c_tx_count_rem,
    output wire [7:0] i2c_rx_count_rem,

    // fifo status
    output wire [10:0] tx_fifo_data_count,
    output wire [10:0] rx_fifo_data_count
);

  localparam FIFO_DEPTH = 1024;

  // FIFO signals
  wire [7:0] tx_fifo_rd_data;
  reg        tx_fifo_rd_en;
  wire       tx_fifo_empty;
  reg  [7:0] rx_fifo_wr_data;
  reg        rx_fifo_wr_en;
  wire       rx_fifo_full;
  wire [10:0] tx_fifo_data_count_int;
  wire [10:0] rx_fifo_data_count_int;

  // 边沿检测
  reg tx_start_prev, rx_start_prev;
  always @(posedge clk or negedge rst_n) begin
    if (!rst_n) begin
      tx_start_prev <= 1'b0;
      rx_start_prev <= 1'b0;
    end else begin
      tx_start_prev <= tx_start_pulse;
      rx_start_prev <= rx_start_pulse;
    end
  end
  wire tx_start = tx_start_pulse && !tx_start_prev;
  wire rx_start = rx_start_pulse && !rx_start_prev;

  // 状态定义
  localparam [2:0]
    IDLE   = 3'd0,
    START  = 3'd1,
    TX     = 3'd2,
    RX     = 3'd3,
    ACK    = 3'd4,
    STOP   = 3'd5,
    LOAD_DATA=3'd6;

  reg [2:0] state;
  reg [31:0] clk_counter;

  // I2C物理层控制
  reg scl_drive, sda_drive;

  // SDA输入同步
  reg [1:0] sda_sync;
  wire sda_in = sda_sync[1];
  always @(posedge clk or negedge rst_n) begin
    if(!rst_n) sda_sync <= 2'b11;
    else sda_sync <= {sda_sync[0], i2c_sda};
  end

  // 传输控制
  reg [7:0] shift_reg;
  reg [2:0] bit_cnt;
  reg ack_err, done, busy;
  reg [7:0] tx_remain, rx_remain;
  reg read_mode;
  reg [9:0] dev_addr;
  reg [15:0] reg_addr;
  reg addr_len;
  reg [1:0] phase; // 阶段: 0=设备地址, 1=寄存器地址, 2=数据
  reg dev_addr_len;
  reg ack_flag;
  reg tx_fifo_rd_en_reg;

  // 时钟分频
  wire [31:0] quarter = (clk_div < 4) ? 1 : (clk_div >> 2);
  wire [31:0] half = (clk_div < 2) ? 1 : (clk_div >> 1);
  wire [31:0] three_quarter = half + quarter;
  
  wire quarter_pt = (clk_counter == quarter);
  wire half_pt    = (clk_counter == half);
  wire three_quarter_pt = (clk_counter == three_quarter);
  wire full_pt    = (clk_counter == clk_div);

  // 时钟计数器
  always @(posedge clk or negedge rst_n) begin
    if(!rst_n) clk_counter <= 0;
    else if (state != IDLE) begin
      if (full_pt) clk_counter <= 0;
      else clk_counter <= clk_counter + 1;
    end else begin
      clk_counter <= 0;
    end
  end

  // 构造地址字节
  function [7:0] build_addr_byte;
    input [9:0] addr;
    input rw_bit;
    input ten_bit;
    begin
      if (ten_bit) 
        build_addr_byte = {5'b11110, addr[9:8], rw_bit};
      else
        build_addr_byte = {addr[6:0], rw_bit};
    end
  endfunction

  always @(posedge clk or negedge rst_n) begin
    if(!rst_n) begin
      tx_fifo_rd_en_reg <= 1'b0;
    end else begin
      tx_fifo_rd_en_reg <= tx_fifo_rd_en;
    end
  end

  // 主状态机 
  always @(posedge clk or negedge rst_n) begin
    if(!rst_n) begin
      state <= IDLE;
      {scl_drive, sda_drive} <= 2'b00;
      {shift_reg, bit_cnt, ack_err, done, busy} <= 0;
      {tx_remain, rx_remain, read_mode} <= 0;
      {dev_addr, reg_addr, addr_len, phase} <= 0;
      {rx_fifo_wr_data, rx_fifo_wr_en, tx_fifo_rd_en,ack_flag} <= 0;
    end else begin
      done <= 0;
      busy <= (state != IDLE);
      rx_fifo_wr_en <= 0;

      case (state)
        IDLE: begin
          {scl_drive, sda_drive, ack_err, bit_cnt, phase,ack_flag} <= 0;
          
          if ((tx_start || rx_start) && i2c_enable) begin
            read_mode <= rx_start;
            dev_addr <= i2c_dev_addr;
            reg_addr <= i2c_reg_addr;
            addr_len <= i2c_reg_addr_len;
            dev_addr_len <= i2c_10bit_addr;
            tx_remain <= tx_start ? i2c_tx_count : 0;
            rx_remain <= rx_start ? i2c_rx_count : 0;
            
            shift_reg <= build_addr_byte(i2c_dev_addr, 1'b0, dev_addr_len);
            state <= START;
          end
        end

        START: begin
          if (clk_counter == 0) begin
            scl_drive <= 1'b0;
            sda_drive <= 1'b0;
          end else if (half_pt) begin
            sda_drive <= 1'b1;
          end else if (full_pt) begin
            scl_drive <= 1'b1;
            bit_cnt <= 3'd0;
            state <= TX;
          end
        end

        TX: begin
          sda_drive <= ~shift_reg[7];
          
          if (half_pt) begin
            scl_drive <= 1'b0;
          end else if (full_pt) begin
            scl_drive <= 1'b1;
            shift_reg <= {shift_reg[6:0], 1'b0};
            
            if (bit_cnt == 3'd7) begin
              bit_cnt <= 3'd0;
              state <= ACK;
            end else begin
              bit_cnt <= bit_cnt + 3'd1;
            end
          end
        end

        RX: begin
            sda_drive <= 1'b0;
          if (half_pt) begin
            scl_drive <= 1'b0;
          end else if (three_quarter_pt) begin
            shift_reg <= {shift_reg[6:0], sda_in};
          end else if (full_pt) begin
            scl_drive <= 1'b1;
            
            if (bit_cnt == 3'd7) begin
              bit_cnt <= 3'd0;
              rx_fifo_wr_data <= shift_reg;
              rx_fifo_wr_en <= 1'b1;
              state <= ACK;
            end else begin
              bit_cnt <= bit_cnt + 3'd1;
            end
          end
        end

ACK: begin
  if (quarter_pt) begin
    if(read_mode && ack_flag && rx_remain > 1) begin
    sda_drive <= 1'b1;
    rx_remain <= rx_remain - 1;
    end else begin
    sda_drive <= 1'b0;
    end
  end else if (half_pt) begin
    scl_drive <= 1'b0;
  end else if (three_quarter_pt) begin
     ack_err <= sda_in;
  end else if (full_pt) begin
    scl_drive <= 1'b1;
    
    if (ack_err) begin
      state <= STOP;
    end else begin
      case (phase)
        2'd0: begin 
        if(dev_addr_len) begin
          shift_reg <= build_addr_byte(i2c_dev_addr, 1'b0, 1'b0);
          state <= TX;
        end else begin
          phase <= addr_len ? 2'd1 : 2'd2;
          shift_reg <= addr_len ? reg_addr[15:8] : reg_addr[7:0];
          state <= TX;
          end
        end
        2'd1: begin // 寄存器高字节完成
          phase <= 2'd2;
          shift_reg <= reg_addr[7:0];
          state <= TX;
        end
        2'd2: begin // 寄存器地址完成
          phase <= 2'd3;
          if (read_mode) begin
            shift_reg <= build_addr_byte(dev_addr, 1'b1, dev_addr_len);
            state <= START;
          end else if (tx_remain > 0 && !tx_fifo_empty) begin
            tx_fifo_rd_en <= 1'b1;
            state <= LOAD_DATA;
          end else begin
            state <= STOP;
          end
        end
        2'd3: begin // 数据阶段
          if (read_mode) begin
            state <= (rx_remain > 0) ? RX : STOP;
            ack_flag <= 1'b1;
          end else if (tx_remain > 0 && !tx_fifo_empty) begin
            tx_fifo_rd_en <= 1'b1;
            state <= LOAD_DATA;
          end else begin
            state <= STOP;
          end
        end
      endcase
    end
  end
end
        LOAD_DATA: begin
          tx_fifo_rd_en <= 1'b0;
          if(tx_fifo_rd_en_reg) begin
            shift_reg <= tx_fifo_rd_data;
            tx_remain <= tx_remain - 1;
            state <= TX;
          end
        end
        STOP: begin
          if (clk_counter == 0) begin
            scl_drive <= 1'b1;
            sda_drive <= 1'b1;
          end else if (half_pt) begin
            scl_drive <= 1'b0;
          end else if (full_pt) begin
            sda_drive <= 1'b0;
            state <= IDLE;
            done <= 1'b1;
          end
        end

        default: state <= IDLE;
      endcase
    end
  end

  // FIFO实例化
  bram_fifo #(
      .DATA_WIDTH(8),
      .FIFO_DEPTH(FIFO_DEPTH)
  ) tx_fifo_inst (
      .clk(clk), .rst_n(rst_n),
      .wr_data(tx_fifo_data), .wr_en(tx_fifo_wr_en),
      .full(tx_fifo_full), .rd_data(tx_fifo_rd_data),
      .rd_en(tx_fifo_rd_en), .empty(tx_fifo_empty),
      .data_count(tx_fifo_data_count_int)  
  );

  bram_fifo #(
      .DATA_WIDTH(8),
      .FIFO_DEPTH(FIFO_DEPTH)
  ) rx_fifo_inst (
      .clk(clk), .rst_n(rst_n),
      .wr_data(rx_fifo_wr_data), .wr_en(rx_fifo_wr_en),
      .full(rx_fifo_full), .rd_data(rx_fifo_data),
      .rd_en(rx_fifo_rd_en), .empty(rx_fifo_empty),
      .data_count(rx_fifo_data_count_int) 
  );

  // 输出信号
  assign rx_data_ready    = !rx_fifo_empty;
  assign tx_busy          = busy && !read_mode;
  assign i2c_busy         = busy;
  assign i2c_done         = done;
  assign i2c_ack_error    = ack_err;
  assign i2c_tx_count_rem = tx_remain;
  assign i2c_rx_count_rem = rx_remain;
  assign tx_fifo_data_count = tx_fifo_data_count_int;
  assign rx_fifo_data_count = rx_fifo_data_count_int;

  // 开漏输出
  assign i2c_scl = scl_drive ? 1'b0 : 1'bz;
  assign i2c_sda = sda_drive ? 1'b0 : 1'bz;

endmodule