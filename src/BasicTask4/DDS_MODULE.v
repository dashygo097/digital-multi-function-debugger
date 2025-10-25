module dds_module_host(
    input         Clk,          
    input         Rst_n,        

    input  [2:0]  wave_sel_in,  
    input  [31:0] ftw_in,       
    input         dds_apply_pulse, 
    output        DA_Clk,       
    output reg [7:0] DA_Data,  
    output reg        nco_zc     

    reg [2:0]  wave_sel_work;
    reg [31:0] ftw_work;

    always @(posedge Clk or negedge Rst_n) begin
        if (!Rst_n) begin
            wave_sel_work <= 3'd0;      
            ftw_work      <= 32'd0;     
        end else if (dds_apply_pulse) begin
            wave_sel_work <= wave_sel_in;
            ftw_work      <= ftw_in;
        end
    end


    reg [31:0] phase_acc;
    wire [31:0] phase_next = phase_acc + ftw_work;
    wire        zc_next    = (phase_next < ftw_work);

    always @(posedge Clk or negedge Rst_n) begin
        if (!Rst_n) begin
            phase_acc <= 32'd0;
            nco_zc    <= 1'b0;
        end 
        else begin
            phase_acc <= phase_next;
            nco_zc    <= zc_next;
        end
    end

    wire [7:0] Rom_Addr = phase_acc[31:24];

    // ============== 三种波形 ROM ==============
    wire [7:0] wave_sin, wave_square, wave_triangle;

    sin_rom_a8d8 ddsrom_sin(
        .addr(Rom_Addr),
        .clk(Clk),
        .q  (wave_sin)
    );

    square_wave_rom_a8d8 ddsrom_square(
        .addr(Rom_Addr),
        .clk(Clk),
        .q  (wave_square)
    );

    triangular_rom_a8d8 ddsrom_triangle(
        .addr(Rom_Addr),
        .clk(Clk),
        .q  (wave_triangle)
    );

    // ============== 波形选择 + 使能门控 ==============
    wire [7:0] raw_data =
        (wave_sel_work==3'd0) ? wave_sin     :
        (wave_sel_work==3'd1) ? wave_square  :
        (wave_sel_work==3'd2) ? wave_triangle:
                                 8'd0;

    always @(posedge Clk or negedge Rst_n) begin
        if (!Rst_n)
            DA_Data <= 8'd0;
        else
            DA_Data <= raw_data : 8'd0;
    end

    // ============== DA时钟保持不变 ==============
    assign DA_Clk = Clk;

endmodule
