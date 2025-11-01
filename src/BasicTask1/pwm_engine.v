`timescale 1ns / 1ps

module pwm_engine (
    input wire clk,
    input wire rst_n,

    // config register
    input wire        pwm_enable,
    input wire [ 7:0] pwm_channel_enable,
    input wire [31:0] pwm_high_count,
    input wire [31:0] pwm_low_count,
    input wire [ 2:0] chanel_config,
    input wire        config_set,

    // physics output
    output wire [7:0] pwm_out
);

  // internal reg
  reg     [31:0] ch_high_count             [0:7];  // high count
  reg     [31:0] ch_low_count              [0:7];  // low  count
  reg     [31:0] ch_period                 [0:7];  // period count
  reg     [31:0] ch_counter                [0:7];  // counter
  reg     [ 7:0] ch_pwm_out;  // output reg

  integer        i;

  // set config reg
  always @(posedge clk or negedge rst_n) begin
    if (!rst_n) begin
      // reset
      for (i = 0; i < 8; i = i + 1) begin
        ch_high_count[i] <= 32'd1000;
        ch_low_count[i]  <= 32'd1000;
        ch_period[i]     <= 32'd2000;
      end
    end else if (config_set && pwm_enable) begin
      // set selected chanel
      ch_high_count[chanel_config] <= pwm_high_count;
      ch_low_count[chanel_config]  <= pwm_low_count;
      ch_period[chanel_config]     <= pwm_high_count + pwm_low_count;
    end
  end

  always @(posedge clk or negedge rst_n) begin
    if (!rst_n) begin
      ch_counter[0] <= 32'd0;
      ch_pwm_out[0] <= 1'b0;
    end else if (pwm_enable && pwm_channel_enable[0]) begin
      if (ch_counter[0] >= ch_period[0] - 1) begin
        ch_counter[0] <= 32'd0;
      end else begin
        ch_counter[0] <= ch_counter[0] + 1;
      end
      ch_pwm_out[0] <= (ch_counter[0] < ch_high_count[0]);
    end else begin
      ch_counter[0] <= 32'd0;
      ch_pwm_out[0] <= 1'b0;
    end
  end

  always @(posedge clk or negedge rst_n) begin
    if (!rst_n) begin
      ch_counter[1] <= 32'd0;
      ch_pwm_out[1] <= 1'b0;
    end else if (pwm_enable && pwm_channel_enable[1]) begin
      if (ch_counter[1] >= ch_period[1] - 1) begin
        ch_counter[1] <= 32'd0;
      end else begin
        ch_counter[1] <= ch_counter[1] + 1;
      end
      ch_pwm_out[1] <= (ch_counter[1] < ch_high_count[1]);
    end else begin
      ch_counter[1] <= 32'd0;
      ch_pwm_out[1] <= 1'b0;
    end
  end

  always @(posedge clk or negedge rst_n) begin
    if (!rst_n) begin
      ch_counter[2] <= 32'd0;
      ch_pwm_out[2] <= 1'b0;
    end else if (pwm_enable && pwm_channel_enable[2]) begin
      if (ch_counter[2] >= ch_period[2] - 1) begin
        ch_counter[2] <= 32'd0;
      end else begin
        ch_counter[2] <= ch_counter[2] + 1;
      end
      ch_pwm_out[2] <= (ch_counter[2] < ch_high_count[2]);
    end else begin
      ch_counter[2] <= 32'd0;
      ch_pwm_out[2] <= 1'b0;
    end
  end

  always @(posedge clk or negedge rst_n) begin
    if (!rst_n) begin
      ch_counter[3] <= 32'd0;
      ch_pwm_out[3] <= 1'b0;
    end else if (pwm_enable && pwm_channel_enable[3]) begin
      if (ch_counter[3] >= ch_period[3] - 1) begin
        ch_counter[3] <= 32'd0;
      end else begin
        ch_counter[3] <= ch_counter[3] + 1;
      end
      ch_pwm_out[3] <= (ch_counter[3] < ch_high_count[3]);
    end else begin
      ch_counter[3] <= 32'd0;
      ch_pwm_out[3] <= 1'b0;
    end
  end

  always @(posedge clk or negedge rst_n) begin
    if (!rst_n) begin
      ch_counter[4] <= 32'd0;
      ch_pwm_out[4] <= 1'b0;
    end else if (pwm_enable && pwm_channel_enable[4]) begin
      if (ch_counter[4] >= ch_period[4] - 1) begin
        ch_counter[4] <= 32'd0;
      end else begin
        ch_counter[4] <= ch_counter[4] + 1;
      end
      ch_pwm_out[4] <= (ch_counter[4] < ch_high_count[4]);
    end else begin
      ch_counter[4] <= 32'd0;
      ch_pwm_out[4] <= 1'b0;
    end
  end

  always @(posedge clk or negedge rst_n) begin
    if (!rst_n) begin
      ch_counter[5] <= 32'd0;
      ch_pwm_out[5] <= 1'b0;
    end else if (pwm_enable && pwm_channel_enable[5]) begin
      if (ch_counter[5] >= ch_period[5] - 1) begin
        ch_counter[5] <= 32'd0;
      end else begin
        ch_counter[5] <= ch_counter[5] + 1;
      end
      ch_pwm_out[5] <= (ch_counter[5] < ch_high_count[5]);
    end else begin
      ch_counter[5] <= 32'd0;
      ch_pwm_out[5] <= 1'b0;
    end
  end

  always @(posedge clk or negedge rst_n) begin
    if (!rst_n) begin
      ch_counter[6] <= 32'd0;
      ch_pwm_out[6] <= 1'b0;
    end else if (pwm_enable && pwm_channel_enable[6]) begin
      if (ch_counter[6] >= ch_period[6] - 1) begin
        ch_counter[6] <= 32'd0;
      end else begin
        ch_counter[6] <= ch_counter[6] + 1;
      end
      ch_pwm_out[6] <= (ch_counter[6] < ch_high_count[6]);
    end else begin
      ch_counter[6] <= 32'd0;
      ch_pwm_out[6] <= 1'b0;
    end
  end

  always @(posedge clk or negedge rst_n) begin
    if (!rst_n) begin
      ch_counter[7] <= 32'd0;
      ch_pwm_out[7] <= 1'b0;
    end else if (pwm_enable && pwm_channel_enable[7]) begin
      if (ch_counter[7] >= ch_period[7] - 1) begin
        ch_counter[7] <= 32'd0;
      end else begin
        ch_counter[7] <= ch_counter[7] + 1;
      end
      ch_pwm_out[7] <= (ch_counter[7] < ch_high_count[7]);
    end else begin
      ch_counter[7] <= 32'd0;
      ch_pwm_out[7] <= 1'b0;
    end
  end

  assign pwm_out = ch_pwm_out;

endmodule
