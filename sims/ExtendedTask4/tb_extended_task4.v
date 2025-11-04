`timescale 1ns/1ps

module tb_bitpack16x4_wave;

    // -------------------------
    // 0) Clock/Reset: 50 MHz
    // -------------------------
    reg clk = 0;
    always #10 clk = ~clk;        // 20ns -> 50MHz

    reg rst_n = 0;
    initial begin
        rst_n = 0;
        #200;
        rst_n = 1;
    end

    // -------------------------
    // 1) DUT ports
    // -------------------------
    reg         start;
    reg  [31:0] sample_cycles;
    reg         samp_vld;
    reg  [3:0]  din;
    wire        out_valid;
    wire [15:0] out_word;
    reg         out_full;
    wire        busy;
    wire        done;

    bitpack16x4 dut (
        .clk(clk),
        .rst_n(rst_n),
        .start(start),
        .sample_cycles(sample_cycles),
        .samp_vld(samp_vld),
        .din(din),
        .out_valid(out_valid),
        .out_word(out_word),
        .out_full(out_full),
        .busy(busy),
        .done(done)
    );

    // -------------------------
    // 2) samp_vld generator
    //    Fs = 50MHz/(DIV+1)
    // -------------------------
    integer DIV = 4;  // 10 MHz sample tick
    integer cnt;
    initial begin
        samp_vld = 0;
        cnt = 0;
        wait(rst_n==1);
        forever begin
            @(posedge clk);
            if (cnt >= DIV) begin
                cnt <= 0;
                samp_vld <= 1'b1;   // 1-cycle pulse
            end else begin
                cnt <= cnt + 1;
                samp_vld <= 1'b0;
            end
        end
    end

    // -------------------------
    // 3) Four-channel stimulus (update on samp_vld)
    //    CH0: toggle every sample
    //    CH1: toggle every 2 samples
    //    CH2: toggle every 4 samples
    //    CH3: 8-bit LFSR (pseudo-random)
    // -------------------------
    reg ch0, ch1, ch2;
    reg [1:0] c2;
    reg [2:0] c4;
    reg [7:0] lfsr8;

    initial begin
        din   = 4'b0;
        ch0   = 0;
        ch1   = 0;
        ch2   = 0;
        c2    = 0;
        c4    = 0;
        lfsr8 = 8'hA5;
        wait(rst_n==1);
        forever begin
            @(posedge clk);
            if (samp_vld) begin
                ch0 <= ~ch0;

                c2 <= c2 + 1;
                if (c2 == 1) begin
                    ch1 <= ~ch1;
                    c2  <= 0;
                end

                c4 <= c4 + 1;
                if (c4 == 3) begin
                    ch2 <= ~ch2;
                    c4  <= 0;
                end

                // taps: 7,5,4,3
                lfsr8 <= {lfsr8[6:0], lfsr8[7]^lfsr8[5]^lfsr8[4]^lfsr8[3]};
            end
            din <= {lfsr8[0], ch2, ch1, ch0}; // {CH3,CH2,CH1,CH0}
        end
    end

    // -------------------------
    // 4) Backpressure model (optional)
    //    Keep 0 for clean flush; uncomment to test stalls.
    // -------------------------
    initial begin
        out_full = 1'b0;
        // // simple example of occasional stall during flush:
        // integer vcnt = 0;
        // wait(rst_n==1);
        // forever begin
        //     @(posedge clk);
        //     if (out_valid) begin
        //         vcnt <= vcnt + 1;
        //         out_full <= (vcnt % 9 == 4); // sporadic stalls
        //     end else begin
        //         out_full <= 1'b0;
        //     end
        // end
    end

    // -------------------------
    // 5) Drive two sessions for waveform inspection
    //    Session 1: 20 samples (1 full block + 1 tail)
    //    Session 2: 32 samples (2 full blocks)
    // -------------------------
    initial begin
        start = 0;
        sample_cycles = 0;

        wait(rst_n==1);
        @(posedge clk);

        // Session 1
        sample_cycles = 32'd20;
        @(posedge clk) start = 1'b1;
        @(posedge clk) start = 1'b0;

        wait(done==1);
        repeat(10) @(posedge clk); // let FLUSH complete

        // Session 2
        sample_cycles = 32'd32;
        @(posedge clk) start = 1'b1;
        @(posedge clk) start = 1'b0;

        wait(done==1);
        repeat(20) @(posedge clk);

        $stop;
    end

    // -------------------------
    // 6) Optional VCD dump (Icarus/VCS). For ModelSim use .wlf.
    // -------------------------
    initial begin
        `ifdef DUMPVCD
            $dumpfile("tb_bitpack16x4_wave.vcd");
            $dumpvars(0, tb_bitpack16x4_wave);
        `endif
    end

endmodule
