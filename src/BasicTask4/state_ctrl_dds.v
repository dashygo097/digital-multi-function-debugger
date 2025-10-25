module state_ctrl_dds_min (
    input  wire        clk,
    input  wire        rst_n,
    input  wire        RestartReq_DDS,   
    input  wire [2:0]  DDS_WaveSel,
    input  wire [31:0] DDS_FTW,        
    output reg  [2:0]  wave_sel_in,
    output reg  [31:0] ftw_in,
    output reg         dds_apply_pulse
);
    reg trig_d, pending;
    wire trig_p = RestartReq_DDS & ~trig_d;

    always @(posedge clk or negedge rst_n) begin
        if(!rst_n) trig_d <= 1'b0;
        else       trig_d <= RestartReq_DDS;
    end

    always @(posedge clk or negedge rst_n) begin
        if(!rst_n) begin
            pending         <= 1'b0;
            ever_applied    <= 1'b0;
            wave_sel_in     <= 3'd0;
            ftw_in          <= 32'd0;
            dds_apply_pulse <= 1'b0;
        end 
        else begin
            if (trig_p) 
            pending <= 1'b1;
            dds_apply_pulse <= 1'b0;

            if (pending) begin
                wave_sel_in     <= DDS_WaveSel;
                ftw_in          <= DDS_FTW;
                dds_apply_pulse <= 1'b1;
                pending         <= 1'b0;
            end
        end
    end
endmodule
