`timescale 1ns/1ps

module tb_signal_measure_ctrl_multi;

    //==============================
    // 1. 信号声明
    //==============================
    reg clk;
    reg rst_n;
    reg enable;
    reg sig_in;

    wire        busy_flag;
    wire        done_flag;
    wire [25:0] period_out;
    wire [7:0]  duty_out;           // DUT 目前仍有端口，TB 不使用
    wire [19:0] high_time_out;
    wire [19:0] low_time_out;       // DUT 目前仍有端口，TB 不使用

    //==============================
    // 2. 时钟产生
    //==============================
    initial clk = 0;
    always #10 clk = ~clk;  // 50MHz 时钟周期 = 20ns

    //==============================
    // 3. 输入信号（周期与占空比可调，异步 real 延时）
    //==============================
    real period_ns   = 2000.0;    // 初始：2000ns → 500kHz
    real duty_percent=   40.0;    // 初始：40%
    real high_ns, low_ns;

    initial begin
        high_ns = period_ns * duty_percent / 100.0;
        low_ns  = period_ns - high_ns;
    end

    // 方波（异步）发生器
    initial begin
        sig_in = 0;
        forever begin
            #(high_ns) sig_in = 0;
            #(low_ns)  sig_in = 1;
        end
    end

    //==============================
    // 4. 控制信号逻辑（两段测试）
    //==============================
    initial begin
        // 复位
        rst_n  = 0;
        enable = 0;
        #200;                 // 200ns 低
        rst_n  = 1;
        #1000;

        // ===== TEST 1: 500kHz, 40% =====
        // 发起一次测量（1 个 clk 脉冲）
        enable = 1;  #40;  enable = 0;
        // 等待结果就绪
        wait(done_flag);
        #2000;

        // ===== TEST 2: 833kHz, 55% =====
        period_ns    = 1200.0;          // 1200ns → 833kHz
        duty_percent =   55.0;
        high_ns = period_ns * duty_percent / 100.0;
        low_ns  = period_ns - high_ns;

        #20000;                          // 换波形后等一会再启动
        enable = 1;  #40;  enable = 0;

        wait(done_flag);
        #2000;

        // 结束仿真
        $finish;
    end

    //==============================
    // 5. DUT 实例化
    //==============================
    signal_measure_ctrl #(
        .CLK_FREQ  (50_000_000),   // 50MHz 系统时钟
        .AVG_CYCLES(8)             // 连续 8 周期累计（总和口径）
    ) u_measure (
        .clk       (clk),
        .rst_n     (rst_n),
        .enable    (enable),
        .sig_in    (sig_in),
        .busy      (busy_flag),
        .finish    (done_flag),
        .period_out(period_out),
        .duty      (duty_out),
        .high_time (high_time_out),
        .low_time  (low_time_out)
    );

    //==============================
    // 6. 波形转储（无监视打印）
    //==============================
    initial begin
        $dumpfile("tb_signal_measure_ctrl_multi.vcd");
        $dumpvars(0, tb_signal_measure_ctrl_multi);
    end

endmodule
