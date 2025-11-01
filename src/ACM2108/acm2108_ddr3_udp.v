
module acm2108_ddr3_udp(
  clk,
  reset_n,
  //LED
  led,
  //ACM2108
  key_in,   //按键切换
  AD0,
  AD1,
  AD0_CLK,
  AD1_CLK,
  DA0_Data,
  DA1_Data,
  DA0_Clk,
  DA1_Clk, 
    
    //ddr
     O_ddr_addr        ,
     O_ddr_ba           ,
     O_ddr_cs_n               ,
     O_ddr_ras_n              ,
     O_ddr_cas_n              ,
     O_ddr_we_n               ,
     O_ddr_clk                ,
     O_ddr_clk_n              ,
     O_ddr_cke                ,
     O_ddr_odt                ,
     O_ddr_reset_n            ,
     O_ddr_dqm          ,
     IO_ddr_dq          ,
     IO_ddr_dqs          ,
     IO_ddr_dqs_n         ,

    //eth_rx
    rgmii_rx_clk_i,
    rgmii_rxd,
    rgmii_rxdv,
    eth_rst_n, 
    eth_mdc,
    eth_mdio, 

    //eth_tx
    rgmii_tx_clk,
    rgmii_txd,
    rgmii_txen
);
  input clk;
  input reset_n;

  //LED
  output [1:0]led;

  //按键切换波形
  input        key_in;
  
  //ACM2108
  input        [7:0]AD0; 
  input        [7:0]AD1;
  output       AD0_CLK;
  output       AD1_CLK;
  output       [7:0]DA0_Data; 
  output       [7:0]DA1_Data;
  output       DA0_Clk;
  output       DA1_Clk;
	
    //ddr
    output [13:0] O_ddr_addr        ;
    output [2:0] O_ddr_ba           ;
    output O_ddr_cs_n               ;
    output O_ddr_ras_n              ;
    output O_ddr_cas_n              ;
    output O_ddr_we_n               ;
    output O_ddr_clk                ;
    output O_ddr_clk_n              ;
    output O_ddr_cke                ;
    output O_ddr_odt                ;
    output O_ddr_reset_n            ;
    output [1:0] O_ddr_dqm          ;
    inout [15:0] IO_ddr_dq          ;
    inout [1:0] IO_ddr_dqs          ;
    inout [1:0] IO_ddr_dqs_n        ;
  
    //eth_rx
    input         rgmii_rx_clk_i;
    input  [3:0]  rgmii_rxd;
    input         rgmii_rxdv;
    output 		  eth_rst_n;
    output        eth_mdc;
    output        eth_mdio; 

    //eth_tx
    output        rgmii_tx_clk;
    output  [3:0] rgmii_txd;
    output        rgmii_txen;

    //Set IMAGE Size  
    parameter LOCAL_MAC  = 48'h00_0a_35_01_fe_c0;
    parameter LOCAL_IP   = 32'hc0_a8_00_02;
    parameter LOCAL_PORT = 16'd5000;
  

//eth_rx
    wire rgmii_rx_clk;
    wire gmii_rx_clk;
    wire [7:0] gmii_rxd;
    wire gmii_rxdv;
    
    wire clk125m_o;
    wire [7:0]payload_dat_o;
    wire payload_valid_o;
    wire one_pkt_done;

    //fifo_rx
    wire rx_empty;
    wire fifo_rd_req;
    wire [7:0]rxdout;

    //rxcmd
    wire cmdvalid_0;
    wire [7:0]address_0;
    wire [31:0]cmd_data_0; 

    wire [7:0]ChannelSel;
    wire [31:0]DataNum;
    wire [31:0]ADC_Speed_Set;   
    wire RestartReq;

    wire        RestartReq_DDS; 
    wire [2:0]  DDS_WaveSel;
    wire [31:0] DDS_FTW;

    //state_dds
    wire [2:0]  wave_sel_in;
    wire [31:0] ftw_in;
    wire        dds_apply_pulse;


  //fifotx
  wire rdfifo_empty;
  wire eth_fifo_wrreq;
  wire [15:0] eth_fifo_wrdata;
  wire eth_fifo_tx_empty;
  wire [10:0] eth_fifo_usedw;
  wire [14:0]rd_data_count;
  wire payload_req_o;
  wire [7:0] dout;

    //eth_tx
    wire tx_done;
    wire tx_en_pulse;
    wire [15:0] lenth_val;
 
    wire gmii_tx_clk;
    wire[7:0] gmii_txd;
    wire gmii_txen;

  
  wire clk_50M;  //除开DDR3以外的模块的时钟信号
  wire pll_locked; //PLL锁存信号
  wire loc_clk400m;
  
  wire ddr3_rst_n;
  wire g_reset;

  wire [7:0]cmd_addr;
  wire [31:0]cmd_data;
  wire cmdvalid;


  wire [15:0]ad_out;
  wire ad_out_valid;

  wire [7:0]uart_rx_data;
  wire uart_rx_done;

  wire ddr3_init_done;

  wire wrfifo_clr;
  wire wrfifo_full;

  wire ad_sample_en;

  wire rdfifo_clr;
  wire rdfifo_rden;
  wire [15:0]rdfifo_dout;


    assign eth_rst_n = 1;
    assign eth_mdc = 1;
    assign eth_mdio = 1;

  assign ddr3_rst_n = pll_locked;
  assign g_reset = ~pll_locked;

  //led[0] 锁相环锁定信号输出，为高，说明锁相环工作正常，时钟正常
  //led[1] DDR3初始化完成标识信号，为高，说明DDR3已经正常完成初始化
  assign led = {ddr3_init_done,pll_locked};
  
   wire clk125m;
   wire AD_Clk;
   wire clk50m;
  //PLL模块：用于产生各个模块的工作时钟
        Gowin_PLL Gowin_PLL(
        .clkin(clk), //input  clkin
        .clkout0(clk_50M), //output  clkout0
//        .clkout1(), //output  clkout1
        .clkout2(clk125m), //output  clkout2
        .clkout3(AD_Clk), //output  clkout3
        .lock(pll_locked), //output  lock
        .mdclk(clk), //input  mdclk
        .reset(~reset_n) //input  reset
);
    
       eth_pll eth_pll(
        .clkout0(rgmii_rx_clk), //output clkout0
        .clkin(rgmii_rx_clk_i), //input clkin
        .mdclk(clk) //input  mdclk
    );

    rgmii_to_gmii rgmii_to_gmii(
        .reset(g_reset),

        .rgmii_rx_clk(rgmii_rx_clk),
        .rgmii_rxd(rgmii_rxd),
        .rgmii_rxdv(rgmii_rxdv),

        .gmii_rx_clk(gmii_rx_clk),
        .gmii_rxdv(gmii_rxdv),
        .gmii_rxd(gmii_rxd),
        .gmii_rxer( )
    ); 
    
    //以太网接收
    eth_udp_rx_gmii eth_udp_rx_gmii(
        .reset_p         (g_reset               ),

        .local_mac       (LOCAL_MAC             ),
        .local_ip        (LOCAL_IP              ),
        .local_port      (LOCAL_PORT            ),

        .clk125m_o       (clk125m_o             ),
        .exter_mac       (             ),
        .exter_ip        (              ),
        .exter_port      (            ),
        .rx_data_length  (        ),
        .data_overflow_i (         ),
        .payload_valid_o (payload_valid_o      ),
        .payload_dat_o   (payload_dat_o        ),

        .one_pkt_done    (one_pkt_done           ),
        .pkt_error       (            ),
        .debug_crc_check (                      ),

        .gmii_rx_clk     (gmii_rx_clk           ),
        .gmii_rxdv       (gmii_rxdv             ),
        .gmii_rxd        (gmii_rxd              )
    );

     //FIFO存储以太网发送过来的命令帧
    fifo_rx fifo_rx(
        .Data(payload_dat_o), //input [7:0] Data
        .Reset(g_reset), //input Reset
        .WrClk(clk125m_o), //input WrClk
        .RdClk(clk_50M), //input RdClk
        .WrEn(payload_valid_o), //input WrEn
        .RdEn(fifo_rd_req), //input RdEn
        .Q(rxdout), //output [7:0] Q
        .Empty(rx_empty), //output Empty
        .Full() //output Full
    );

    eth_cmd eth_cmd (
        .clk(clk_50M),
        .reset_n(~g_reset),
        .fifo_rd_req(fifo_rd_req),
        .rx_empty(rx_empty),
        .fifodout(rxdout),
        .cmdvalid(cmdvalid_0),
        .address(address_0),
        .cmd_data(cmd_data_0)
    );

	cmd_rx cmd_rx_0(
		.clk(clk_50M),
		.reset_n(~g_reset),
		.cmdvalid(cmdvalid_0),
		.cmd_addr(address_0),
		.cmd_data(cmd_data_0),
		
		.ChannelSel(ChannelSel),
		.DataNum(DataNum),
		.ADC_Speed_Set(ADC_Speed_Set),
		.RestartReq(RestartReq),
        .RestartReq_DDS(RestartReq_DDS),    
        .DDS_WaveSel(DDS_WaveSel),
        .DDS_FTW(DDS_FTW)
	);
    
    assign AD0_CLK = AD_Clk;

    reg RestartReq_0_d0,RestartReq_0_d1;
    reg [31:0]Number_d0,Number_d1;

    always@(posedge clk125m_o)
    begin
        Number_d0 <= DataNum;
        Number_d1 <= Number_d0;

        RestartReq_0_d0 <= RestartReq;
        RestartReq_0_d1 <= RestartReq_0_d0;
    end

  wire adc_data_en;
  speed_ctrl speed_ctrl(
      .clk(clk_50M),
      .reset_n(~g_reset),
      .ad_sample_en(ad_sample_en),
      .adc_data_en(adc_data_en),
      .div_set(ADC_Speed_Set)
  ); 
  
  //将acm2108采样的8位数据转换成16位的数据，方便给上位机进行分析
  ad_8bit_to_16bit ad_8bit_to_16bit(
      .clk(clk_50M),
      .ad_sample_en(ad_sample_en),
      .ch_sel(ChannelSel[1:0]),
      .AD0(AD0),
      .AD1(AD1),
      .ad_out(ad_out),
      .ad_out_valid(ad_out_valid)
    );
  
    state_ctrl_dds_min state_ctrl_dds_min (
    .Clk              (clk_50M),  
    .clk125m          (clk125m),     
    .Rst_n            (reset_n),    
    .wave_sel_in      (DDS_WaveSel),   
    .ftw_in           (DDS_FTW),        
    .dds_apply_pulse  (RestartReq_DDS),          
    .DA0_Data         (DA0_Data),        
    .DA0_Clk          (DA0_Clk)          
);

       
     //状态机
   state_ctrl state_ctrl(
          .clk(clk_50M),
          .reset(g_reset),
          .start_sample(RestartReq), //ADC启动采集标志信号
          .set_sample_num(DataNum),//需要采集的数量，32位，4G
          .rdfifo_empty(rdfifo_empty), //DDR双端口模块读FIFO为空标志信号
          .rdfifo_dout(rdfifo_dout), //从DDR中读出的16位数据
          .wrfifo_full(wrfifo_full),  //DDR写FIFO为满标志信号
          .adc_data_en(adc_data_en),  //ADC输出数据使能信号
          .wrfifo_clr(wrfifo_clr),  //DDR双端口模块的写FIFO清除信号
          .rdfifo_clr(rdfifo_clr),  //DDR双端口模块的读FIFO清除信号
          .rdfifo_rden(rdfifo_rden), //DDR双端口模块的读使能信号
          .ad_sample_en(ad_sample_en),   //ADC采样使能标志信号
          .eth_fifo_wrreq(eth_fifo_wrreq), //以太网发送fifo_tx的写请求信号
          .eth_fifo_wrdata(eth_fifo_wrdata)    //需要以太网发送fifo_tx中写入的数据
    );
 

    wire [27:0] app_addr_max = 256*1024*1024-1;
    wire [7:0] burst_len = 8'd128;

wire mdrp_inc;     
wire [1:0] mdrp_op;     
wire [7:0] mdrp_wdata;     
wire [7:0] mdrp_rdata;     
wire pll_stop;     
reg pll_stop_r;
reg wr;
wire pll_lock;
reg [15:0] pll_lock_reg;
 
always @ (posedge clk_50M)
    pll_lock_reg    <=  {pll_lock_reg[14:0], pll_lock};
 
always@(posedge clk_50M)
    pll_stop_r <= pll_stop;
 
always@(posedge clk_50M)
if(!pll_lock_reg[15])
    wr <= 1'b0;
else if(~pll_stop & pll_stop_r)begin
    wr <= 1'b1;
end
else if(pll_stop & (~pll_stop_r))begin
    wr <= 1'b1;
end
else begin
    wr <= 1'b0;
end
 
pll_mDRP_intf u_pll_mDRP_intf(
    .clk(clk_50M),
    .rst_n(1'b1),
    .pll_lock(pll_lock_reg[15]),
    .wr(wr),
    .mdrp_inc(mdrp_inc),
    .mdrp_op(mdrp_op),
    .mdrp_wdata(mdrp_wdata),
    .mdrp_rdata(mdrp_rdata)
);    
 
    ddr_pll ddr_pll(
    .lock(pll_lock), //output lock
    .clkout0(), //output clkout0
    .clkout2(loc_clk400m), //output clkout2
    .mdrdo(mdrp_rdata), //output [7:0] mdrdo
    .clkin(clk_50M), //input clkin
    .reset(!reset_n), //input reset
    .pll_init_bypass(pll_lock_reg[15]), //input  pll_init_bypass
    .mdclk(clk_50M), //input mdclk
    .mdopc(mdrp_op), //input [1:0] mdopc
    .mdainc(mdrp_inc), //input mdainc
    .mdwdi(mdrp_wdata) //input [7:0] mdwdi
);


        ddr3_ctrl_2port ddr3_ctrl_2port(
        .clk(clk_50M)                 ,      //50M时钟信号
        .pll_lock(pll_lock)            ,
        .pll_stop(pll_stop)                ,
        .clk_400m(loc_clk400m)            ,      //DDR3参考时钟信号
        .sys_rst_n(~g_reset)           ,      //外部复位信号
        .init_calib_complete(ddr3_init_done) ,    //DDR初始化完成信号

        //用户接口
        .rd_load(rdfifo_clr)             ,   //输出源更新信号
        .wr_load(wrfifo_clr)             ,   //输入源更新信号
        .app_addr_rd_min(28'd0)     ,   //读DDR3的起始地址
        .app_addr_rd_max(app_addr_max)     ,   //读DDR3的结束地址
        .rd_bust_len(burst_len)         ,   //从DDR3中读数据时的突发长度
        .app_addr_wr_min(28'd0)     ,   //写DD3的起始地址
        .app_addr_wr_max(app_addr_max)     ,   //写DDR的结束地址
        .wr_bust_len(burst_len)         ,   //向DDR3中写数据时的突发长度

        .wr_clk(clk_50M)             ,//wr_fifo的写时钟信号
        .wfifo_wren(ad_out_valid && adc_data_en)          , //wr_fifo的写使能信号
        .wfifo_din(ad_out)           , //写入到wr_fifo中的数据
        .wrfifo_full(wrfifo_full),
        .rd_clk(clk_50M)              , //rd_fifo的读时钟信号
        .rfifo_rden(rdfifo_rden)          , //rd_fifo的读使能信号
        .rdfifo_empty(rdfifo_empty),
        .rfifo_dout(rdfifo_dout)          , //rd_fifo读出的数据信号 

        //DDR3   
        .ddr3_dq(IO_ddr_dq)             ,   //DDR3 数据
        .ddr3_dqs_n(IO_ddr_dqs_n)          ,   //DDR3 dqs负
        .ddr3_dqs_p(IO_ddr_dqs)          ,   //DDR3 dqs正  
        .ddr3_addr(O_ddr_addr)           ,   //DDR3 地址   
        .ddr3_ba(O_ddr_ba)             ,   //DDR3 banck 选择
        .ddr3_ras_n(O_ddr_ras_n)          ,   //DDR3 行选择
        .ddr3_cas_n(O_ddr_cas_n)          ,   //DDR3 列选择
        .ddr3_we_n(O_ddr_we_n)           ,   //DDR3 读写选择
        .ddr3_reset_n(O_ddr_reset_n)        ,   //DDR3 复位
        .ddr3_ck_p(O_ddr_clk)          ,   //DDR3 时钟正
        .ddr3_ck_n(O_ddr_clk_n)           ,   //DDR3 时钟负
        .ddr3_cke(O_ddr_cke)            ,   //DDR3 时钟使能
        .ddr3_cs_n(O_ddr_cs_n)           ,   //DDR3 片选
        .ddr3_dm(O_ddr_dqm)             ,   //DDR3_dm
        .ddr3_odt(O_ddr_odt)                //DDR3_odt   
    );

//以太网发送FIFO
	fifo_tx fifo_tx(
		.Data({eth_fifo_wrdata[7:0],eth_fifo_wrdata[15:8]}), //input [15:0] Data
		.Reset(g_reset), //input Reset
		.WrClk(clk_50M), //input WrClk
		.RdClk(clk125m_o), //input RdClk
		.WrEn(eth_fifo_wrreq), //input WrEn
		.RdEn(payload_req_o), //input RdEn
		.Wnum(eth_fifo_usedw), //output [10:0] Wnum
		.Rnum(rd_data_count), //output [11:0] Rnum
		.Q(dout), //output [7:0] Q
		.Empty(eth_fifo_tx_empty), //output Empty
		.Full() //output Full
	);


    //以太网发送控制模块
    eth_send_ctrl eth_send_ctrl(
        .clk125M(clk125m_o),     
        .reset_n(~g_reset),  //模块的复位信号
        .eth_tx_done(tx_done),    //以太网一个包发送完毕信号
        .restart_req(RestartReq_0_d1),
        .fifo_rd_cnt(rd_data_count), //从FIFO中读取的数据个数
        .total_data_num(Number_d1),  //需要发送的数据总数
        .pkt_tx_en(tx_en_pulse),   //以太网发送使能信号
        .pkt_length(lenth_val)  //以太网需要发送的数据的长度
    ); 

    //以太网发送模块
    eth_udp_tx_gmii eth_udp_tx_gmii
    (
        .clk125m       (clk125m_o               ),
        .reset_p       (g_reset               ),

        .tx_en_pulse   (tx_en_pulse           ),
        .tx_done       (tx_done               ),

        .dst_mac       (48'hFF_FF_FF_FF_FF_FF            ),
        .src_mac       (LOCAL_MAC             ), 
        .dst_ip        (32'hc0_a8_00_03             ),
        .src_ip        (LOCAL_IP              ),
        .dst_port      (16'd6102           ),
        .src_port      (LOCAL_PORT            ),


        .data_length   (lenth_val        ),

        .payload_req_o (payload_req_o        ),
        .payload_dat_i (dout        ),

        .gmii_tx_clk   (gmii_tx_clk           ),
        .gmii_txen     (gmii_txen             ),
        .gmii_txd      (gmii_txd              )
    );

     gmii_to_rgmii gmii_to_rgmii(
      .reset_n(~g_reset),

      .gmii_tx_clk(gmii_tx_clk),
      .gmii_txd(gmii_txd),
      .gmii_txen(gmii_txen),
      .gmii_txer(1'b0),

      .rgmii_tx_clk(rgmii_tx_clk),
      .rgmii_txd(rgmii_txd),
      .rgmii_txen(rgmii_txen)
    );


endmodule
