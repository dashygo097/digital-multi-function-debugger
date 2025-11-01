module dds_module_host(
    input         Clk,          
    input         Rst_n,        
    input  [2:0]  wave_sel_in,  
    input  [31:0] ftw_in,       
    output        DA_Clk,       
    output reg [7:0] DA_Data
);

    reg [2:0] wave_sel_work;
    reg [31:0] ftw_work;
    
    always @(posedge Clk or negedge Rst_n) begin
        if (!Rst_n) begin
            wave_sel_work <= 3'd0;
            ftw_work <= 32'd0;
        end else begin
            wave_sel_work <= wave_sel_in;
            ftw_work <= ftw_in;
        end
    end

    reg [31:0] phase_acc;
    always @(posedge Clk or negedge Rst_n) begin
        if (!Rst_n)
            phase_acc <= 32'd0;
        else
            phase_acc <= phase_acc + ftw_work;  // 连续累加
    end

    // ==================== ROM地址生成 ====================
    wire [7:0] Rom_Addr = phase_acc[31:24];

    // ==================== 波形ROM ====================
    wire [7:0] wave_sin_q, wave_square_q, wave_triangle_q;

    sin_rom_a8d8 ddsrom_sin(
        .addr(Rom_Addr),
        .clk(Clk),
        .q(wave_sin_q)
    );

    square_wave_rom_a8d8 ddsrom_square(
        .addr(Rom_Addr),
        .clk(Clk),
        .q(wave_square_q)
    );

    triangular_rom_a8d8 ddsrom_triangle(
        .addr(Rom_Addr),
        .clk(Clk),
        .q(wave_triangle_q)
    );

    // ==================== 波形选择输出 ====================
    always @(posedge Clk or negedge Rst_n) begin
        if (!Rst_n)
            DA_Data <= 8'd0;
        else
            case (wave_sel_work)
                3'd0: DA_Data <= wave_sin_q;
                3'd1: DA_Data <= wave_square_q;
                3'd2: DA_Data <= wave_triangle_q;
                default: DA_Data <= wave_sin_q;
            endcase
    end

    assign DA_Clk = !Clk;

endmodule