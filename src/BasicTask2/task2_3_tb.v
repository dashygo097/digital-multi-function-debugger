`timescale 1ns/1ps

module tb_signal_measure_ctrl_multi;

    //==============================
    // 1. 信号声明
    //==============================
    reg clk;
    reg rst_n;
    reg enable;
    reg sig_in;

    wire busy_flag;
    wire done_flag;
    wire [25:0] freq_out;
    wire [7:0]  duty_out;
    wire [19:0] high_time_out, low_time_out;

    //==============================
    // 2. 时钟产生
    //==============================
    initial clk = 0;
    always #10 clk = ~clk;  // 50MHz 时钟周期 = 20ns

    //==============================
    // 3. 输入信号（周期与占空比可调）
    //==============================
    real period_ns = 2000;       // 初始周期：2000ns → 500kHz
    real duty_percent = 40.0;    // 初始占空比：40%
    real high_ns, low_ns;

    initial begin
        high_ns = period_ns * duty_percent / 100.0;
        low_ns  = period_ns - high_ns;
    end

    // 方波信号产生
    initial begin
        sig_in = 0;
        forever begin
            #(high_ns) sig_in = 1;
            #(low_ns)  sig_in = 0;
        end
    end

    //==============================
    // 4. 控制信号逻辑
    //==============================
    initial begin
        // 初始化复位
        rst_n = 0;
        enable = 0;
        #200;
        rst_n = 1;
        #1000;

        // ===== 第一次测量 =====
        $display("===== [TEST 1] 500kHz, 40%% duty =====");
        enable = 1;
        #40;
        enable = 0;

        wait(done_flag);  // 等待测量完成
        #2000;

        // ===== 第二次测量 =====
        $display("===== [TEST 2] 833kHz, 55%% duty =====");
        period_ns = 1200;         // 新周期：1200ns → 833kHz
        duty_percent = 55.0;      // 占空比 55%
        high_ns = period_ns * duty_percent / 100.0;
        low_ns  = period_ns - high_ns;

        #20000;
        enable = 1;
        #40;
        enable = 0;

        wait(done_flag);
        #2000;

        $display("==== 所有测量完成 ====");
        $finish;
    end

    //==============================
    // 5. 被测模块实例化
    //==============================
    signal_measure_ctrl #(
        .CLK_FREQ(50_000_000),   // 50MHz 系统时钟
        .AVG_CYCLES(8)           // 测量8个周期平均
    ) u_measure (
        .clk(clk),
        .rst_n(rst_n),
        .enable(enable),
        .sig_in(sig_in),
        .busy(busy_flag),
        .finish(done_flag),       // ✅ 用 done_flag 避免与系统 $finish 冲突
        .freq(freq_out),
        .duty(duty_out),
        .high_time(high_time_out),
        .low_time(low_time_out)
    );

    //==============================
    // 6. 仿真监控输出
    //==============================
    initial begin
        $dumpfile("tb_signal_measure_ctrl_multi.vcd");
        $dumpvars(0, tb_signal_measure_ctrl_multi);

        $display("==== 多周期测量仿真开始 ====");
        $display("系统时钟 = 50 MHz, 平均周期数 = 32");
        $display("=============================================");
        $display("Time(ns) | busy | done | freq(Hz) | duty(%%) | Th | Tl");
        $display("--------------------------------------------------------");

        $monitor("%8t |   %b  |   %b  | %8d | %3d | %6d | %6d",
                 $time, busy_flag, done_flag, freq_out, duty_out,
                 high_time_out, low_time_out);
    end

endmodule
