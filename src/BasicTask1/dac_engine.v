module dac_engine (
    input wire clk,
    input wire rst_n,

    //config register
    input wire dds_enable,
    input wire [31:0] frequency,
    input wire [7:0] amplitude,

    //write data
    input wire wave_wr_pulse,
    input wire [7:0] wave_data,
    
    //physics pin
    output wire dac_clk,
    output wire [7:0] dac_out,

    //state reg
    output wire waveform_ready
);

  localparam PHASE_WIDTH = 32;
  localparam WAVE_POINTS = 256;
  localparam INDEX_WIDTH = 8;

  // BRAM存储波形
  reg [7:0] waveform_memory[0:WAVE_POINTS-1];
  
  // 写控制逻辑
  reg [INDEX_WIDTH-1:0] write_address;
  reg ready_flag;
  
  // 波形写入
  reg wave_wr_pulse_reg;
  wire wave_wr_pulse_en = wave_wr_pulse && ~ wave_wr_pulse_reg;
  
  always @(posedge clk or posedge rst_n) begin
    if (rst_n) begin
      wave_wr_pulse_reg <= 0;
    end
    else begin
      wave_wr_pulse_reg <= wave_wr_pulse;
    end
  end

  always @(posedge clk or negedge rst_n) begin
    if (!rst_n) begin
      write_address <= 0;
      ready_flag <= 0;
    end else if (wave_wr_pulse_en) begin
      waveform_memory[write_address] <= wave_data;
      if (write_address == WAVE_POINTS-1) begin
        write_address <= 0;
        ready_flag <= 1;
      end else begin
        write_address <= write_address + 1'b1;
      end
    end
  end
  
  assign waveform_ready = ready_flag;

  // 相位累加器
  reg [PHASE_WIDTH-1:0] phase_accumulator;
  wire [INDEX_WIDTH-1:0] read_address;
  
  always @(posedge clk or negedge rst_n) begin
    if (!rst_n) begin
      phase_accumulator <= 0;
    end else if (dds_enable && waveform_ready) begin
      phase_accumulator <= phase_accumulator + frequency;
    end
  end
  
  // 读取地址
  assign read_address = phase_accumulator[31:24];

  // BRAM读取
  reg [7:0] waveform_output;
  always @(posedge clk or negedge rst_n) begin
    if (!rst_n) begin
      waveform_output <= 0;
    end else if (dds_enable && waveform_ready) begin
      waveform_output <= waveform_memory[read_address];
    end
  end

  // 振幅控制
  reg [15:0] amplitude_scaled;
  always @(posedge clk or negedge rst_n) begin
    if (!rst_n) begin
      amplitude_scaled <= 0;
    end else begin
      amplitude_scaled <= waveform_output * amplitude;
    end
  end
  
  assign dac_out = amplitude_scaled[15:8];
  assign dac_clk = dds_enable? clk : 1'b0;
endmodule