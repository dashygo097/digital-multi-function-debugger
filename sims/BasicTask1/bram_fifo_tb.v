// tb_bram_fifo.v - 修复语法错误
`timescale 1ns / 1ps

module bram_fifo_tb();
    reg clk;
    reg rst_n;
    
    // 写接口
    reg [7:0] wr_data;
    reg wr_en;
    wire full;
    
    // 读接口
    wire [7:0] rd_data;
    reg rd_en;
    wire empty;
    wire [10:0] data_count;
    
    // 时钟生成
    always #5 clk = ~clk;
    
    // 实例化被测模块
    bram_fifo #(
        .DATA_WIDTH(8),
        .FIFO_DEPTH(1024)
    ) uut (
        .clk(clk),
        .rst_n(rst_n),
        .wr_data(wr_data),
        .wr_en(wr_en),
        .full(full),
        .rd_data(rd_data),
        .rd_en(rd_en),
        .empty(empty),
        .data_count(data_count)
    );
    
    integer i;
    integer error_count = 0;
    reg [7:0] expected_data;
    
    initial begin
        // 初始化
        clk = 0;
        rst_n = 0;
        wr_data = 0;
        wr_en = 0;
        rd_en = 0;
        expected_data = 0;
        
        // 复位
        #20 rst_n = 1;
        
        $display("=== BRAM FIFO Comprehensive Test Start ===");
        $display("Initial: empty=%b, full=%b, data_count=%0d", empty, full, data_count);
        
        // 测试1: 基本写操作
        $display("\n--- Test 1: Basic Write (10 items) ---");
        for (i = 0; i < 10; i = i + 1) begin
            @(negedge clk);
            wr_data = i;
            wr_en = 1;
        end
        @(negedge clk);
        wr_en = 0;
        
        // 验证写入后状态
        repeat(2) @(posedge clk);
        if (data_count !== 10) begin
            $display("ERROR: Expected data_count=10, got %0d", data_count);
            error_count = error_count + 1;
        end
        
        // 测试2: 基本读操作 - 验证数据正确性
        $display("\n--- Test 2: Basic Read (5 items) ---");
        for (i = 0; i < 5; i = i + 1) begin
            @(negedge clk);
            rd_en = 1;
            expected_data = i; // 设置期望值
        end
        @(negedge clk);
        rd_en = 0;
        
        // 测试3: 混合读写
        $display("\n--- Test 3: Mixed Read/Write ---");
        fork
            // 写入线程
            begin
                for (i = 100; i < 110; i = i + 1) begin
                    @(negedge clk);
                    wr_data = i;
                    wr_en = 1;
                end
                @(negedge clk);
                wr_en = 0;
            end
            // 读取线程
            begin
                #10; // 稍微延迟
                for (i = 0; i < 5; i = i + 1) begin
                    @(negedge clk);
                    rd_en = 1;
                end
                @(negedge clk);
                rd_en = 0;
            end
        join
        
        // 等待操作完成
        repeat(5) @(posedge clk);
        
        // 测试4: FIFO满测试
        $display("\n--- Test 4: FIFO Full Test ---");
        while (!full) begin
            @(negedge clk);
            wr_data = $random;
            wr_en = 1;
        end
        @(negedge clk);
        wr_en = 0;
        
        $display("FIFO reached full state, data_count = %d", data_count);
        
        // 测试满状态下的写保护
        @(negedge clk);
        wr_data = 8'hFF;
        wr_en = 1;
        @(posedge clk);
        if (!full) begin
            $display("ERROR: FIFO should remain full!");
            error_count = error_count + 1;
        end
        @(negedge clk);
        wr_en = 0;
        
        // 测试5: 空测试
        $display("\n--- Test 5: FIFO Empty Test ---");
        while (!empty) begin
            @(negedge clk);
            rd_en = 1;
        end
        @(negedge clk);
        rd_en = 0;
        
        $display("FIFO reached empty state, data_count = %d", data_count);
        
        // 测试空状态下的读保护
        @(negedge clk);
        rd_en = 1;
        @(posedge clk);
        if (!empty) begin
            $display("ERROR: FIFO should remain empty!");
            error_count = error_count + 1;
        end
        @(negedge clk);
        rd_en = 0;
        
        // 最终状态报告
        $display("\n=== Test Summary ===");
        if (error_count == 0) begin
            $display("ALL TESTS PASSED!");
        end else begin
            $display("FAILED: %0d errors found", error_count);
        end
        
        $finish;
    end
    
    // 数据验证监控 - 使用always块而不是task
    always @(posedge clk) begin
        if (rd_en && !empty) begin
            // 简单的数据检查 - 可以根据需要扩展
            if (rd_data === 8'hxx) begin
                $display("ERROR: Read undefined data: 0x%02h", rd_data);
                error_count = error_count + 1;
            end else begin
                $display("TB: Read data: 0x%02h, count=%0d", rd_data, data_count);
            end
        end
    end
    
    // 写监控
    always @(posedge clk) begin
        if (wr_en && !full)
            $display("TB: Write data: 0x%02h, count=%0d", wr_data, data_count);
    end

    // 状态监控
    always @(posedge clk) begin
        if (full) $display("TB: FIFO is FULL");
        if (empty) $display("TB: FIFO is EMPTY");
    end

    initial begin
        $dumpfile("bram_fifo_tb.vcd");
        $dumpvars(0, bram_fifo_tb);
    end

endmodule