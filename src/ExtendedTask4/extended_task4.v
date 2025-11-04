// 1) 采样分频：Fs = Fclk/(div_set+1)
module sample_enable_div(
    input  wire        clk,
    input  wire        rst_n,
    input  wire        enable,
    input  wire [31:0] div_set,
    output reg         sample_pulse
);
    reg [31:0] cnt;
    always @(posedge clk or negedge rst_n) begin
        if(!rst_n) begin
            cnt<=0; sample_pulse<=0;
        end else if(!enable) begin
            cnt<=0; sample_pulse<=0;
        end else begin
            if(cnt>=div_set) begin
                cnt<=0; 
                sample_pulse<=1'b1;
            end else begin
                cnt<=cnt+1'b1; 
                sample_pulse<=1'b0;
            end
        end
    end
endmodule

// 2) 四通道并采→每通道16位打包→顺序写出4个16-bit字
module bitpack16x4(
    input  wire        clk,
    input  wire        rst_n,

    input  wire        start,           // 1拍触发一次会话
    input  wire [31:0] sample_cycles,   // 需要采的“采样拍数”
    input  wire        samp_vld,        // 采样脉冲
    input  wire [3:0]  din,             // {CH3,CH2,CH1,CH0}

    // 流接口到FIFO写端
    output reg         out_valid,
    output reg [15:0]  out_word,
    input  wire        out_full,        // 对方满则暂停
    output reg         busy,
    output reg         done
);
    localparam IDLE=0, RUN=1, FLUSH=2, DONE=3;
    reg [1:0]  st;

    // 每通道16位移位寄存器
    reg [15:0] sh0, sh1, sh2, sh3;
    reg [3:0]  step_idx;                
    reg [31:0] left_cycles;             

    // Flush 时的顺序输出缓存
    reg [15:0] out0, out1, out2, out3;
    reg [1:0]  flush_idx;               // 0..3

    wire block_ready = (step_idx == 4'd15);
    wire last_block  = (left_cycles == 32'd0);
    wire tail_block  = (last_block && (step_idx != 4'd0));
    wire no_tail     = (last_block && (step_idx == 4'd0));

    task prepare_flush_words;
        input is_tail;                  // 0=整块；1=尾块
        reg [4:0] shift_amt;
    begin
        shift_amt = is_tail ? (5'd16 - {1'b0,step_idx}) : 5'd0;
        out0 = (shift_amt==0) ? sh0 : (sh0 << shift_amt);
        out1 = (shift_amt==0) ? sh1 : (sh1 << shift_amt);
        out2 = (shift_amt==0) ? sh2 : (sh2 << shift_amt);
        out3 = (shift_amt==0) ? sh3 : (sh3 << shift_amt);
        flush_idx = 2'd0;
    end
    endtask

    always @(posedge clk or negedge rst_n) begin
        if(!rst_n) begin
            st<=IDLE; busy<=0; done<=0; out_valid<=0; out_word<=0;
            sh0<=0; sh1<=0; sh2<=0; sh3<=0; step_idx<=0; left_cycles<=0;
            out0<=0; out1<=0; out2<=0; out3<=0; flush_idx<=0;
        end else begin
            out_valid<=0; done<=0;

            case(st)
            IDLE: begin
                busy<=0; step_idx<=0;
                sh0<=0; sh1<=0; sh2<=0; sh3<=0;
                if(start) begin
                    busy<=1;
                    left_cycles <= sample_cycles;
                    st<=RUN;
                end
            end

            RUN: begin
                if(samp_vld && (left_cycles!=0)) begin
                    sh0 <= {sh0[14:0], din[0]};
                    sh1 <= {sh1[14:0], din[1]};
                    sh2 <= {sh2[14:0], din[2]};
                    sh3 <= {sh3[14:0], din[3]};
                    step_idx    <= step_idx + 1'b1;
                    left_cycles <= left_cycles - 1'b1;
                end

                if(block_ready && samp_vld) begin
                    prepare_flush_words(1'b0);
                    st <= FLUSH;
                end else if(tail_block) begin
                    prepare_flush_words(1'b1);
                    st <= FLUSH;
                end else if(no_tail) begin
                    st <= DONE;
                end
            end

            FLUSH: begin
                if(!out_full) begin
                    out_valid <= 1'b1;
                    case(flush_idx)
                        2'd0: out_word <= out0;
                        2'd1: out_word <= out1;
                        2'd2: out_word <= out2;
                        2'd3: out_word <= out3;
                    endcase
                    if(flush_idx == 2'd3) begin
                        sh0<=0; sh1<=0; sh2<=0; sh3<=0; step_idx<=0;
                        if(last_block) st <= DONE;
                        else           st <= RUN;
                    end
                    flush_idx <= flush_idx + 1'b1;
                end
            end

            DONE: begin
                busy<=0; done<=1; st<=IDLE;
            end
            endcase
        end
    end
endmodule

// 3) 简单16-bit同步FIFO（DEPTH=2^AW）
module sync_fifo16 #(
    parameter AW = 10  // DEPTH = 1024 (可按需调大)
)(
    input  wire        clk,
    input  wire        rst_n,
    // 写端
    input  wire        wr_en,
    input  wire [15:0] wr_data,
    output wire        full,
    // 读端
    input  wire        rd_en,
    output reg  [15:0] rd_data,
    output wire        empty,
    // 监控
    output wire [AW:0] level
);
    localparam DEPTH = (1<<AW);
    reg [15:0] mem [0:DEPTH-1];
    reg [AW-1:0] wptr, rptr;
    reg [AW:0]   cnt;

    assign full  = (cnt == DEPTH);
    assign empty = (cnt == 0);
    assign level = cnt;

    always @(posedge clk or negedge rst_n) begin
        if(!rst_n) begin
            wptr<=0; rptr<=0; cnt<=0; rd_data<=0;
        end else begin
            if(wr_en && !full) begin
                mem[wptr] <= wr_data;
                wptr <= wptr + 1'b1;
                cnt  <= cnt + 1'b1;
            end
            if(rd_en && !empty) begin
                rd_data <= mem[rptr];
                rptr <= rptr + 1'b1;
                cnt  <= cnt - 1'b1;
            end
        end
    end
endmodule


module quadcap_levelparam_top #(
    parameter FIFO_AW     = 10,   // 16b 字深度
    parameter DIV_DEFAULT = 49,   // 复位默认 Fs = Fclk/(49+1)
    parameter CYC_DEFAULT = 1600  // 复位默认采样拍数
)(
    input  wire        clk,
    input  wire        rst_n,

    // 四通道输入
    input  wire [3:0]  sig_in,            // {CH3,CH2,CH1,CH0}

    // ===== 参数（电平） =====
    input  wire        enable_level,      // 采样使能（电平保持）
    input  wire [31:0] div_value,         // Fs = Fclk/(DIV+1)
    input  wire [31:0] cycles_value,      // 采样拍数（每拍4路各1bit）

    // ===== 动作（脉冲） =====
    input  wire        start_pulse_in,    // 触发一次采集
    input  wire        data_re_pulse,     // 读 DATA 请求（读即弹）
    input  wire        fifo_clr_pulse,    // 清 FIFO（同步清）

    output reg         data_valid,        // 下一拍有效
    output reg  [15:0] data_word,         // 半字数据

    output wire        busy,              // 采集中
    output reg         done,              // 完成标志（start 清0，done 置1）
    output wire        empty,             // FIFO 空
    output wire        full,              // FIFO 满
    output wire [13:0] level,             // FIFO 近似深度
    output wire        irq                // (~empty) | done
);

    // 1) 参数寄存
    reg        reg_enable;
    reg [31:0] reg_div;
    reg [31:0] reg_cycles;

    always @(posedge clk or negedge rst_n) begin
        if(!rst_n) begin
            reg_enable <= 1'b0;
            reg_div    <= DIV_DEFAULT;
            reg_cycles <= CYC_DEFAULT;
        end 
        else begin
            reg_enable <= enable_level;
            reg_div    <= div_value;
            reg_cycles <= cycles_value;
        end
    end

    // 2) 采样脉冲
    wire samp_pulse;
    sample_enable_div u_div(
        .clk(clk), 
        .rst_n(rst_n),
        .enable(reg_enable),
        .div_set(reg_div),
        .sample_pulse(samp_pulse)
    );

    // 3) 打包器
    wire        bp_valid, bp_done, bp_busy;
    wire [15:0] bp_word;

    bitpack16x4 u_bp(
        .clk(clk), 
        .rst_n(rst_n),
        .start(start_pulse_in),          // 动作：脉冲触发
        .sample_cycles(reg_cycles),
        .samp_vld(samp_pulse),
        .din(sig_in),
        .out_valid(bp_valid),
        .out_word(bp_word),
        .out_full(full),
        .busy(bp_busy),
        .done(bp_done)
    );

    // 4) FIFO（同步）：写=来自打包器；读=来自 data_re_pulse
    wire [FIFO_AW:0] fifo_level;
    reg  fifo_rd_en;
    wire [15:0] fifo_rd_data;

    // 同步“清空”脉冲：一拍有效
    reg fifo_clr_d;
    always @(posedge clk or negedge rst_n) begin
        if(!rst_n) fifo_clr_d <= 1'b0;
        else       fifo_clr_d <= fifo_clr_pulse;
    end
    wire fifo_rst_n = rst_n & ~fifo_clr_d;

    sync_fifo16 #(.AW(FIFO_AW)) u_fifo (
        .clk(clk), .rst_n(fifo_rst_n),
        .wr_en (bp_valid && !full),
        .wr_data(bp_word),
        .full  (full),
        .rd_en (fifo_rd_en),
        .rd_data(fifo_rd_data),
        .empty (empty),
        .level (fifo_level)
    );
    assign level = {{(14-(FIFO_AW+1)){1'b0}}, fifo_level};

    // 5) DATA 读出：读脉冲 → 下一拍有效
    reg pop_pending;
    always @(posedge clk or negedge rst_n) begin
        if(!rst_n) begin
            fifo_rd_en  <= 1'b0;
            pop_pending <= 1'b0;
            data_valid  <= 1'b0;
            data_word   <= 16'd0;
        end else begin
            fifo_rd_en  <= data_re_pulse & ~empty;
            data_valid  <= pop_pending;
            if(pop_pending) 
            data_word <= fifo_rd_data;
            pop_pending <= fifo_rd_en;
        end
    end


    // 6) 状态/中断
    assign busy = bp_busy;

    // sticky done：打包器 done 置位；start 清除
    always @(posedge clk or negedge rst_n) begin
        if(!rst_n) done <= 1'b0;
        else if (start_pulse_in) done <= 1'b0;
        else if (bp_done)        done <= 1'b1;
    end

    assign irq = (~empty) | done;

endmodule
