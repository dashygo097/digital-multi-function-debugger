`timescale 1ns/1ps

module pwm_engine_tb;
    // input signal
    reg        clk;
    reg        rst_n;
    reg        pwm_enable;
    reg [7:0]  pwm_channel_enable;
    reg [31:0] pwm_high_count;
    reg [31:0] pwm_low_count;
    reg [2:0]  chanel_config;
    reg        config_set;
    
    // output signal
    wire [7:0] pwm_out;
    
    // instantiate 
    pwm_engine uut (
        .clk(clk),
        .rst_n(rst_n),
        .pwm_enable(pwm_enable),
        .pwm_channel_enable(pwm_channel_enable),
        .pwm_high_count(pwm_high_count),
        .pwm_low_count(pwm_low_count),
        .chanel_config(chanel_config),
        .config_set(config_set),
        .pwm_out(pwm_out)
    );
    
    // clk
    always #10 clk = ~clk;
    
    // Task: Configure PWM channel
    task configure_channel;
        input [2:0] channel;
        input [31:0] high_val;
        input [31:0] low_val;
        begin
            chanel_config = channel;
            pwm_high_count = high_val;
            pwm_low_count = low_val;
            config_set = 1'b1;
            @(posedge clk);
            config_set = 1'b0;
            @(posedge clk);
        end
    endtask
    
    initial begin
        // initialize signals
        clk = 0;
        rst_n = 0;
        pwm_enable = 0;
        pwm_channel_enable = 8'h00;
        pwm_high_count = 0;
        pwm_low_count = 0;
        chanel_config = 0;
        config_set = 0;
        
        // system reset
        #20 rst_n = 1;
        #20;

        // Test 1: Basic functionality - Channel 0
        $display("\nTest 1: Configure Channel 0 - 50%% duty cycle");
        configure_channel(3'd0, 32'd5, 32'd5);
        pwm_channel_enable[0] = 1'b1;
        pwm_enable = 1'b1;
        
        #400;
        
        // Test 2: Different duty cycle channel
        $display("\nTest 2: Configure Channel 1 - 25%% duty cycle");
        configure_channel(3'd1, 32'd2, 32'd6);
        pwm_channel_enable[1] = 1'b1;
        
        #400;
        
        // Test 3: Dynamic reconfiguration
        $display("\nTest 3: Dynamic reconfigure Channel 0 - 75%% duty cycle");
        configure_channel(3'd0, 32'd6, 32'd2);
        
        #400;
        
        // Test 4: Disable single channel
        $display("\nTest 4: Disable Channel 1");
        pwm_channel_enable[1] = 1'b0;
        
        #200;
        
        // Test 5: Global disable
        $display("\nTest 5: Global PWM disable");
        pwm_enable = 1'b0;
        
        #100;
        
        // Test 6: Multiple channels with different parameters
        $display("\nTest 6: Enable all channels with different parameters");
        pwm_enable = 1'b1;
        pwm_channel_enable = 8'hFF;
        
        configure_channel(3'd2, 32'd1, 32'd3);
        configure_channel(3'd3, 32'd7, 32'd1);
        configure_channel(3'd4, 32'd4, 32'd4);
        configure_channel(3'd5, 32'd3, 32'd5);
        configure_channel(3'd6, 32'd8, 32'd8);
        configure_channel(3'd7, 32'd9, 32'd1);
        
        #1000;
        
        $display("\n=== All tests completed ===");
        $display("Time: %t ns", $time);
        $finish;
    end
    
    // Generate vcd file 
    initial begin
        $dumpfile("pwm_engine_tb.vcd");
        $dumpvars(0, pwm_engine_tb);
        #10000;
        $finish;
    end
    
endmodule