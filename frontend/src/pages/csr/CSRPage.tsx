import React from "react";
import { WithRouter, WithRouterProps } from "@utils";
import { ProtocolContext, ConnectionState } from "../../contexts";
import "@styles/csr.css";

interface CSRMessage {
  timestamp: string;
  type: "TX" | "RX" | "INFO" | "ERROR";
  data: string;
  id: string;
}

interface Preset {
  name: string;
  address: string;
  description: string;
  section: string;
  value?: string;
  loading?: boolean;
}

interface CSRPageState {
  csrAddress: string;
  csrData: string;
  csrOperation: "READ" | "WRITE";
  messages: CSRMessage[];
  autoScroll: boolean;
  selectedSection: string;
  showRxAsHex: boolean;
  lastProcessedMessageIndex: number;
  sections: Array<{
    id: string;
    name: string;
    startAddr: string;
    endAddr: string;
  }>;
  presets: Preset[];
  isRegisterSidebarOpen: boolean;
  isLoadingRegisters: boolean;
}

class CSRPage extends React.Component<WithRouterProps, CSRPageState> {
  static contextType = ProtocolContext;
  context!: React.ContextType<typeof ProtocolContext>;

  private terminalEndRef: React.RefObject<HTMLDivElement>;

  constructor(props: WithRouterProps) {
    super(props);
    this.terminalEndRef = React.createRef();

    this.state = {
      csrAddress: "0x10000",
      csrData: "0xDEADBEEF",
      csrOperation: "WRITE",
      messages: [],
      autoScroll: false,
      selectedSection: "all",
      showRxAsHex: true,
      lastProcessedMessageIndex: -1,
      isRegisterSidebarOpen: true,
      isLoadingRegisters: false,
      sections: [
        {
          id: "slv_regs",
          name: "SLV Registers",
          startAddr: "0x10000",
          endAddr: "0x14000",
        },
        {
          id: "slv_ram",
          name: "SLV RAM",
          startAddr: "0x14000",
          endAddr: "0x18000",
        },
        {
          id: "acm2108",
          name: "ACM2108",
          startAddr: "0x18000",
          endAddr: "0x1C000",
        },
        {
          id: "signal_measure",
          name: "Signal Measure",
          startAddr: "0x1C000",
          endAddr: "0x20000",
        },
        {
          id: "bitseq",
          name: "Bit Sequence",
          startAddr: "0x20000",
          endAddr: "0x24000",
        },
        {
          id: "uart_engine",
          name: "UART Engine",
          startAddr: "0x24000",
          endAddr: "0x28000",
        },
        {
          id: "spi_engine",
          name: "SPI Engine",
          startAddr: "0x28000",
          endAddr: "0x2C000",
        },
        {
          id: "pwm_engine",
          name: "PWM Engine",
          startAddr: "0x2C000",
          endAddr: "0x30000",
        },
        {
          id: "i2c_engine",
          name: "I2C Engine",
          startAddr: "0x30000",
          endAddr: "0x34000",
        },
        {
          id: "dac_engine",
          name: "DAC Engine",
          startAddr: "0x34000",
          endAddr: "0x38000",
        },
      ],
      presets: [
        {
          name: "SLV_REG0",
          address: "0x10000",
          description: "[31:0]: slv_reg0",
          section: "slv_regs",
        },
        {
          name: "SLV_REG1",
          address: "0x11000",
          description: "[31:0]: slv_reg1",
          section: "slv_regs",
        },
        {
          name: "SLV_REG2",
          address: "0x12000",
          description: "[31:0]: slv_reg2",
          section: "slv_regs",
        },
        {
          name: "SLV_REG3",
          address: "0x13000",
          description: "[31:0]: slv_reg3",
          section: "slv_regs",
        },
        {
          name: "RAM_REGION",
          address: "0x14000",
          description: "[31:0]: ram_data (0x00-0x20)",
          section: "slv_ram",
        },
        {
          name: "CONTROL",
          address: "0x18000",
          description: "[0]: restart_req - System restart request",
          section: "acm2108",
        },
        {
          name: "STATUS",
          address: "0x18004",
          description: "[1]: ddr_init, [0]: pll_locked - System status",
          section: "acm2108",
        },
        {
          name: "CHANNEL_SEL",
          address: "0x18008",
          description: "[7:0]: channel_sel - ADC channel selection",
          section: "acm2108",
        },
        {
          name: "DATA_NUM",
          address: "0x1800C",
          description: "[31:0]: data_num - Number of data samples",
          section: "acm2108",
        },
        {
          name: "ADC_SPEED",
          address: "0x18010",
          description: "[31:0]: adc_speed - ADC sampling speed",
          section: "acm2108",
        },
        {
          name: "RESTART",
          address: "0x18014",
          description: "[0]: restart_req - ADC restart (auto-clear)",
          section: "acm2108",
        },
        {
          name: "DDS_CONTROL",
          address: "0x18018",
          description: "[0]: dds_restart - DDS restart (auto-clear)",
          section: "acm2108",
        },
        {
          name: "DDS_WAVE_SEL",
          address: "0x1801C",
          description: "[2:0]: wave_sel - DDS waveform selection",
          section: "acm2108",
        },
        {
          name: "DDS_FTW",
          address: "0x18020",
          description: "[31:0]: ftw - DDS Frequency Tuning Word",
          section: "acm2108",
        },
        {
          name: "DDR_STATUS",
          address: "0x18024",
          description: "[0]: ddr_init - DDR3 init status",
          section: "acm2108",
        },
        {
          name: "SIG_CONTROL",
          address: "0x1C000",
          description: "[0]: enable - Enable signal measurement",
          section: "signal_measure",
        },
        {
          name: "SIG_STATUS",
          address: "0x1C004",
          description: "[0]: busy, [1]: finish - Measurement status",
          section: "signal_measure",
        },
        {
          name: "SIG_PERIOD",
          address: "0x1C008",
          description: "[25:0]: period_out - Measured period",
          section: "signal_measure",
        },
        {
          name: "SIG_HIGH_TIME",
          address: "0x1C00C",
          description: "[19:0]: high_time - Measured high time",
          section: "signal_measure",
        },
        {
          name: "BS_CONTROL",
          address: "0x20000",
          description: "[0]: sync_enable, [1]: arm_load, [2]: group_start",
          section: "bitseq",
        },
        {
          name: "BS_STATUS",
          address: "0x20004",
          description: "[7:0]: playing - Channel playing status",
          section: "bitseq",
        },
        {
          name: "BS_ARM_MASK",
          address: "0x20008",
          description: "[7:0]: arm_mask_in - Channel arm mask",
          section: "bitseq",
        },
        {
          name: "BS_START_CH",
          address: "0x2000C",
          description: "[7:0]: start_ch_bus - Channel start",
          section: "bitseq",
        },
        {
          name: "BS_STOP_CH",
          address: "0x20010",
          description: "[7:0]: stop_ch_bus - Channel stop",
          section: "bitseq",
        },
        {
          name: "BS_WR_CTRL",
          address: "0x20014",
          description: "[2:0]: wr_ch, [7]: wr_en - Write control",
          section: "bitseq",
        },
        {
          name: "BS_WR_ADDR",
          address: "0x20018",
          description: "[7:0]: wr_addr - Write address",
          section: "bitseq",
        },
        {
          name: "BS_WR_DATA",
          address: "0x2001C",
          description: "[0]: wr_bit - Write data bit",
          section: "bitseq",
        },
        {
          name: "LEN_CH0",
          address: "0x20020",
          description: "[31:0]: len - Channel 0 sequence length",
          section: "bitseq",
        },
        {
          name: "LEN_CH1",
          address: "0x20024",
          description: "[31:0]: len - Channel 1 sequence length",
          section: "bitseq",
        },
        {
          name: "LEN_CH2",
          address: "0x20028",
          description: "[31:0]: len - Channel 2 sequence length",
          section: "bitseq",
        },
        {
          name: "LEN_CH3",
          address: "0x2002C",
          description: "[31:0]: len - Channel 3 sequence length",
          section: "bitseq",
        },
        {
          name: "LEN_CH4",
          address: "0x20030",
          description: "[31:0]: len - Channel 4 sequence length",
          section: "bitseq",
        },
        {
          name: "LEN_CH5",
          address: "0x20034",
          description: "[31:0]: len - Channel 5 sequence length",
          section: "bitseq",
        },
        {
          name: "LEN_CH6",
          address: "0x20038",
          description: "[31:0]: len - Channel 6 sequence length",
          section: "bitseq",
        },
        {
          name: "LEN_CH7",
          address: "0x2003C",
          description: "[31:0]: len - Channel 7 sequence length",
          section: "bitseq",
        },
        {
          name: "RATE_DIV_CH0",
          address: "0x20040",
          description: "[31:0]: rate_div - Channel 0 rate divider",
          section: "bitseq",
        },
        {
          name: "RATE_DIV_CH1",
          address: "0x20044",
          description: "[31:0]: rate_div - Channel 1 rate divider",
          section: "bitseq",
        },
        {
          name: "RATE_DIV_CH2",
          address: "0x20048",
          description: "[31:0]: rate_div - Channel 2 rate divider",
          section: "bitseq",
        },
        {
          name: "RATE_DIV_CH3",
          address: "0x2004C",
          description: "[31:0]: rate_div - Channel 3 rate divider",
          section: "bitseq",
        },
        {
          name: "RATE_DIV_CH4",
          address: "0x20050",
          description: "[31:0]: rate_div - Channel 4 rate divider",
          section: "bitseq",
        },
        {
          name: "RATE_DIV_CH5",
          address: "0x20054",
          description: "[31:0]: rate_div - Channel 5 rate divider",
          section: "bitseq",
        },
        {
          name: "RATE_DIV_CH6",
          address: "0x20058",
          description: "[31:0]: rate_div - Channel 6 rate divider",
          section: "bitseq",
        },
        {
          name: "RATE_DIV_CH7",
          address: "0x2005C",
          description: "[31:0]: rate_div - Channel 7 rate divider",
          section: "bitseq",
        },
        {
          name: "PHASE_OFF_CH0",
          address: "0x20060",
          description: "[31:0]: phase_off - Channel 0 phase offset",
          section: "bitseq",
        },
        {
          name: "PHASE_OFF_CH1",
          address: "0x20064",
          description: "[31:0]: phase_off - Channel 1 phase offset",
          section: "bitseq",
        },
        {
          name: "PHASE_OFF_CH2",
          address: "0x20068",
          description: "[31:0]: phase_off - Channel 2 phase offset",
          section: "bitseq",
        },
        {
          name: "PHASE_OFF_CH3",
          address: "0x2006C",
          description: "[31:0]: phase_off - Channel 3 phase offset",
          section: "bitseq",
        },
        {
          name: "PHASE_OFF_CH4",
          address: "0x20070",
          description: "[31:0]: phase_off - Channel 4 phase offset",
          section: "bitseq",
        },
        {
          name: "PHASE_OFF_CH5",
          address: "0x20074",
          description: "[31:0]: phase_off - Channel 5 phase offset",
          section: "bitseq",
        },
        {
          name: "PHASE_OFF_CH6",
          address: "0x20078",
          description: "[31:0]: phase_off - Channel 6 phase offset",
          section: "bitseq",
        },
        {
          name: "PHASE_OFF_CH7",
          address: "0x2007C",
          description: "[31:0]: phase_off - Channel 7 phase offset",
          section: "bitseq",
        },
        {
          name: "UART_CONFIG",
          address: "0x24000",
          description: "[31:0]: clk_div",
          section: "uart_engine",
        },
        {
          name: "UART_PARITY_CFG",
          address: "0x24004",
          description: "[0]: check_en, [2:1]: check_type",
          section: "uart_engine",
        },
        {
          name: "UART_FRAME_CFG",
          address: "0x24008",
          description: "[1:0]: data_bit, [3:2]: stop_bit",
          section: "uart_engine",
        },
        {
          name: "UART_TX_DATA",
          address: "0x24010",
          description: "[7:0]: tx_fifo_data",
          section: "uart_engine",
        },
        {
          name: "UART_TX_CTRL",
          address: "0x24014",
          description: "[0]: tx_fifo_valid (write 1 to push)",
          section: "uart_engine",
        },
        {
          name: "UART_RX_DATA",
          address: "0x24020",
          description: "[7:0]: rx_fifo_data (read only)",
          section: "uart_engine",
        },
        {
          name: "UART_RX_CTRL",
          address: "0x24024",
          description: "[0]: rx_fifo_ready (write 1 to pop)",
          section: "uart_engine",
        },
        {
          name: "UART_STATUS",
          address: "0x24030",
          description: "[0]: tx_busy, [1]: rx_busy, [2]: rx_error",
          section: "uart_engine",
        },
        {
          name: "UART_TX_COUNT",
          address: "0x24034",
          description: "[15:0]: tx_byte_count",
          section: "uart_engine",
        },
        {
          name: "UART_RX_COUNT",
          address: "0x24038",
          description: "[15:0]: rx_byte_count",
          section: "uart_engine",
        },
        {
          name: "UART_FIFO_STATUS",
          address: "0x2403C",
          description: "[0]: tx_fifo_ready, [1]: rx_fifo_valid",
          section: "uart_engine",
        },
        {
          name: "SPI_CONFIG",
          address: "0x28000",
          description: "[31:0]: clk_div",
          section: "spi_engine",
        },
        {
          name: "SPI_CONTROL",
          address: "0x28004",
          description: "[0]: spi_enable, [2:1]: spi_mode, [3]: spi_msb_first",
          section: "spi_engine",
        },
        {
          name: "SPI_TX_DATA",
          address: "0x28010",
          description: "[7:0]: tx_fifo_data",
          section: "spi_engine",
        },
        {
          name: "SPI_TX_CTRL",
          address: "0x28014",
          description: "[0]: tx_fifo_valid (write 1 to push)",
          section: "spi_engine",
        },
        {
          name: "SPI_RX_DATA",
          address: "0x28020",
          description: "[7:0]: rx_fifo_data (read only)",
          section: "spi_engine",
        },
        {
          name: "SPI_RX_CTRL",
          address: "0x28024",
          description: "[0]: rx_fifo_ready (write 1 to pop)",
          section: "spi_engine",
        },
        {
          name: "SPI_STATUS",
          address: "0x28030",
          description: "[0]: spi_busy, [1]: spi_mosi_oe",
          section: "spi_engine",
        },
        {
          name: "SPI_TX_COUNT",
          address: "0x28034",
          description: "[15:0]: spi_tx_count",
          section: "spi_engine",
        },
        {
          name: "SPI_RX_COUNT",
          address: "0x28038",
          description: "[15:0]: spi_rx_count",
          section: "spi_engine",
        },
        {
          name: "SPI_FIFO_STATUS",
          address: "0x2803C",
          description: "[0]: tx_fifo_ready, [1]: rx_fifo_valid",
          section: "spi_engine",
        },
        {
          name: "SPI_PIN_STATUS",
          address: "0x28040",
          description:
            "[0]: spi_sck, [1]: spi_mosi, [2]: spi_miso, [3]: spi_cs",
          section: "spi_engine",
        },
        {
          name: "PWM_CONTROL",
          address: "0x2C000",
          description: "[0]: pwm_enable, [8:1]: pwm_channel_enable",
          section: "pwm_engine",
        },
        {
          name: "PWM_CH_SEL",
          address: "0x2C004",
          description: "[2:0]: channel_config - Select channel",
          section: "pwm_engine",
        },
        {
          name: "PWM_HIGH_COUNT",
          address: "0x2C008",
          description: "[31:0]: pwm_high_count - High period",
          section: "pwm_engine",
        },
        {
          name: "PWM_LOW_COUNT",
          address: "0x2C00C",
          description: "[31:0]: pwm_low_count - Low period",
          section: "pwm_engine",
        },
        {
          name: "PWM_CONFIG_SET",
          address: "0x2C010",
          description: "[0]: config_set - Write 1 to apply",
          section: "pwm_engine",
        },
        {
          name: "PWM_OUTPUT",
          address: "0x2C014",
          description: "[7:0]: pwm_out - Current PWM outputs",
          section: "pwm_engine",
        },
        {
          name: "PWM_CH_STATUS",
          address: "0x2C018",
          description: "[7:0]: channel_enable - Channel enable status",
          section: "pwm_engine",
        },
        {
          name: "I2C_CONFIG",
          address: "0x30000",
          description: "[31:0]: clk_div",
          section: "i2c_engine",
        },
        {
          name: "I2C_CONTROL",
          address: "0x30004",
          description:
            "[0]: i2c_enable, [1]: master_mode, [2]: 10bit_addr, [3]: restart",
          section: "i2c_engine",
        },
        {
          name: "I2C_DEV_ADDR",
          address: "0x30008",
          description: "[9:0]: i2c_dev_addr (7-bit or 10-bit)",
          section: "i2c_engine",
        },
        {
          name: "I2C_TRANS_CFG",
          address: "0x3000C",
          description: "[7:0]: tx_count, [15:8]: rx_count, [31]: start",
          section: "i2c_engine",
        },
        {
          name: "I2C_TX_DATA",
          address: "0x30010",
          description: "[7:0]: tx_fifo_data",
          section: "i2c_engine",
        },
        {
          name: "I2C_TX_CTRL",
          address: "0x30014",
          description: "[0]: tx_fifo_valid (write 1 to push)",
          section: "i2c_engine",
        },
        {
          name: "I2C_RX_DATA",
          address: "0x30020",
          description: "[7:0]: rx_fifo_data (read only)",
          section: "i2c_engine",
        },
        {
          name: "I2C_RX_CTRL",
          address: "0x30024",
          description: "[0]: rx_fifo_ready (write 1 to pop)",
          section: "i2c_engine",
        },
        {
          name: "I2C_STATUS",
          address: "0x30030",
          description: "[0]: busy, [1]: done, [2]: ack_error",
          section: "i2c_engine",
        },
        {
          name: "I2C_CNT_STATUS",
          address: "0x30034",
          description: "[7:0]: tx_cnt_rem, [15:8]: rx_cnt_rem",
          section: "i2c_engine",
        },
        {
          name: "I2C_FIFO_STATUS",
          address: "0x30038",
          description: "[0]: tx_fifo_ready, [1]: rx_fifo_valid",
          section: "i2c_engine",
        },
        {
          name: "DAC_CONTROL",
          address: "0x34000",
          description: "[0]: dds_enable, [1]: high_quality_mode",
          section: "dac_engine",
        },
        {
          name: "DAC_FREQUENCY",
          address: "0x34004",
          description: "[31:0]: frequency_control_word",
          section: "dac_engine",
        },
        {
          name: "DAC_AMPLITUDE",
          address: "0x34008",
          description: "[15:0]: amplitude_scale (0x0000-0xFFFF)",
          section: "dac_engine",
        },
        {
          name: "DAC_PHASE_OFFSET",
          address: "0x3400C",
          description: "[15:0]: phase_offset (0x0000-0xFFFF)",
          section: "dac_engine",
        },
        {
          name: "DAC_WAVE_ADDR",
          address: "0x34010",
          description: "[8:0]: waveform_memory_address (0-511)",
          section: "dac_engine",
        },
        {
          name: "DAC_WAVE_DATA",
          address: "0x34014",
          description: "[15:0]: waveform_data_value (signed)",
          section: "dac_engine",
        },
        {
          name: "DAC_WAVE_WR_EN",
          address: "0x34018",

          description: "[0]: wave_write_enable (write 1 to push, auto-clears)",
          section: "dac_engine",
        },
        {
          name: "DAC_OUTPUT",
          address: "0x3401C",
          description: "[15:0]: current_dac_output_value (real-time)",
          section: "dac_engine",
        },
        {
          name: "DAC_STATUS",
          address: "0x34020",
          description: "[0]: engine_running, [1]: high_quality_active",
          section: "dac_engine",
        },
      ],
    };
  }

  componentDidUpdate(prevProps: WithRouterProps, prevState: CSRPageState) {
    if (
      this.state.autoScroll &&
      prevState.messages.length !== this.state.messages.length
    ) {
      this.terminalEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }

  private stringToBytesLatin1 = (str: string): number[] => {
    const bytes: number[] = [];
    for (let i = 0; i < str.length; i++) {
      bytes.push(str.charCodeAt(i) & 0xff);
    }
    return bytes;
  };

  private formatRxData = (data: string): string => {
    if (!this.state.showRxAsHex) {
      return data;
    }
    const bytes = this.stringToBytesLatin1(data);
    const hexString = bytes
      .map((b) => b.toString(16).padStart(2, "0").toUpperCase())
      .join(" ");
    const asciiString = bytes
      .map((b) => (b >= 32 && b <= 126 ? String.fromCharCode(b) : "."))
      .join("");
    return `[HEX] ${hexString} | ${asciiString}`;
  };

  private buildCSRCommand = (
    operation: "READ" | "WRITE",
    addressStr: string,
    dataStr?: string,
  ): Uint8Array | null => {
    try {
      const addr = parseInt(addressStr.replace(/^0x/i, ""), 16);
      if (isNaN(addr) || addr < 0 || addr > 0xffffffff) {
        this.addMessage("ERROR", "Invalid address format. Use hex: 0x10000");
        return null;
      }

      let data = 0;
      if (operation === "WRITE") {
        data = parseInt((dataStr || "0x0").replace(/^0x/i, ""), 16);
        if (isNaN(data) || data < 0 || data > 0xffffffff) {
          this.addMessage("ERROR", "Invalid data format. Use hex: 0xDEADBEEF");
          return null;
        }
      }

      const cmd = new Uint8Array(9);
      cmd[0] = operation === "WRITE" ? 0x00 : 0x01;
      const addressBytes = new DataView(new ArrayBuffer(4));
      addressBytes.setUint32(0, addr, false);
      cmd.set(new Uint8Array(addressBytes.buffer), 1);

      if (operation === "WRITE") {
        const dataBytes = new DataView(new ArrayBuffer(4));
        dataBytes.setUint32(0, data, false);
        cmd.set(new Uint8Array(dataBytes.buffer), 5);
      }

      return cmd;
    } catch (error: any) {
      this.addMessage("ERROR", `Command build failed: ${error.message}`);
      return null;
    }
  };

  private sendCSRCommand = async () => {
    if (
      this.context?.serialTerminal.connectionState !== ConnectionState.CONNECTED
    ) {
      this.addMessage(
        "ERROR",
        "❌ Serial port not connected! Please connect via Serial Terminal page.",
      );
      return;
    }
    const { csrOperation, csrAddress, csrData } = this.state;
    const cmd = this.buildCSRCommand(csrOperation, csrAddress, csrData);
    if (!cmd) return;

    const address = parseInt(csrAddress.replace(/^0x/i, ""), 16);
    const dataVal =
      csrOperation === "WRITE" ? parseInt(csrData.replace(/^0x/i, ""), 16) : 0;
    const operationStr =
      csrOperation === "WRITE"
        ? `WRITE 0x${dataVal.toString(16).padStart(8, "0").toUpperCase()} to 0x${address.toString(16).padStart(8, "0").toUpperCase()}`
        : `READ from 0x${address.toString(16).padStart(8, "0").toUpperCase()}`;

    this.addMessage("TX", `[CSR ${operationStr}]`);

    try {
      const response = await this.context.serialCmd(cmd);
      if (response && csrOperation === "READ") {
        const dataView = new DataView(response.buffer);
        const readValue = dataView.getUint32(1, false);
        const hexValue = `0x${readValue.toString(16).padStart(8, "0").toUpperCase()}`;
        this.addMessage(
          "RX",
          `[CSR READ from 0x${address.toString(16).padStart(8, "0").toUpperCase()}] -> ${hexValue}`,
        );
      } else if (!response) {
        this.addMessage("ERROR", "No response or timeout for CSR command.");
      }
    } catch (error: any) {
      this.addMessage("ERROR", `❌ Send failed: ${error.message}`);
    }
  };

  private readRegisterValue = async (
    preset: Preset,
    index: number,
  ): Promise<void> => {
    if (
      this.context?.serialTerminal.connectionState !== ConnectionState.CONNECTED
    ) {
      this.addMessage("ERROR", "Serial port not connected.");
      return;
    }

    this.setState((prevState) => {
      const newPresets = [...prevState.presets];
      newPresets[index] = { ...newPresets[index], loading: true };
      return { presets: newPresets };
    });

    const cmd = this.buildCSRCommand("READ", preset.address);
    if (!cmd) {
      this.setState((prevState) => {
        const newPresets = [...prevState.presets];
        newPresets[index] = { ...newPresets[index], loading: false };
        return { presets: newPresets };
      });
      return;
    }

    try {
      this.addMessage("TX", `[CSR READ from ${preset.address}]`);
      const response = await this.context.serialCmd(cmd);
      let hexValue = "Error";
      if (response) {
        const dataView = new DataView(response.buffer);
        const status = dataView.getUint8(0);
        if (status === 0x01) {
          const value = dataView.getUint32(1, false);
          hexValue = `0x${value.toString(16).padStart(8, "0").toUpperCase()}`;
          this.addMessage(
            "RX",
            `[CSR READ from ${preset.address}] -> ${hexValue}`,
          );
        } else {
          this.addMessage(
            "ERROR",
            `Read failed for ${preset.address}. Status: 0x${status.toString(16)}`,
          );
        }
      } else {
        this.addMessage("ERROR", `No response for ${preset.address}`);
      }

      this.setState((prevState) => {
        const newPresets = [...prevState.presets];
        newPresets[index] = {
          ...newPresets[index],
          value: hexValue,
          loading: false,
        };
        return { presets: newPresets };
      });
    } catch (e: any) {
      this.addMessage(
        "ERROR",
        `Read failed for ${preset.address}: ${e.message}`,
      );
      this.setState((prevState) => {
        const newPresets = [...prevState.presets];
        newPresets[index] = {
          ...newPresets[index],
          value: "Error",
          loading: false,
        };
        return { presets: newPresets };
      });
    }
  };

  private readAllRegisters = async () => {
    this.setState({ isLoadingRegisters: true });
    for (let i = 0; i < this.state.presets.length; i++) {
      await this.readRegisterValue(this.state.presets[i], i);
    }
    this.setState({ isLoadingRegisters: false });
  };

  private loadPreset = (preset: Preset) => {
    this.setState({ csrAddress: preset.address });
    this.addMessage(
      "INFO",
      `Loaded: ${preset.name} (${preset.address}) - ${preset.description}`,
    );
  };

  private addMessage = (type: "TX" | "RX" | "INFO" | "ERROR", data: string) => {
    this.setState((prev) => ({
      messages: [
        ...prev.messages,
        {
          timestamp: new Date().toLocaleTimeString("en-US", {
            hour12: false,
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            fractionalSecondDigits: 3,
          }),
          type,
          data,
          id: `${Date.now()}-${Math.random()}`,
        },
      ],
    }));
  };

  private clearMessages = () => {
    this.setState({ messages: [] });
  };

  private exportLog = () => {
    const log = this.state.messages
      .map((m) => `[${m.timestamp}] ${m.type}: ${m.data}`)
      .join("\n");
    const element = document.createElement("a");
    element.setAttribute(
      "href",
      "data:text/plain;charset=utf-8," + encodeURIComponent(log),
    );
    element.setAttribute("download", `csr-log-${Date.now()}.txt`);
    element.style.display = "none";
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  private getFilteredPresets = () => {
    if (this.state.selectedSection === "all") {
      return this.state.presets;
    }
    return this.state.presets.filter(
      (preset) => preset.section === this.state.selectedSection,
    );
  };

  private getConnectionStatusText = (): string => {
    const connectionState =
      this.context?.serialTerminal.connectionState ||
      ConnectionState.DISCONNECTED;
    switch (connectionState) {
      case ConnectionState.CONNECTED:
        return "✓ Connected";
      case ConnectionState.CONNECTING:
        return "⏳ Connecting...";
      case ConnectionState.DISCONNECTING:
        return "⏳ Disconnecting...";
      case ConnectionState.DISCONNECTED:
        return "○ Disconnected";
      case ConnectionState.ERROR:
        return "❌ Error";
      default:
        return "○ Unknown";
    }
  };

  private getConnectionStatusClass = (): string => {
    const connectionState =
      this.context?.serialTerminal.connectionState ||
      ConnectionState.DISCONNECTED;
    switch (connectionState) {
      case ConnectionState.CONNECTED:
        return "status-connected";
      case ConnectionState.CONNECTING:
      case ConnectionState.DISCONNECTING:
        return "status-connecting";
      case ConnectionState.DISCONNECTED:
        return "status-disconnected";
      case ConnectionState.ERROR:
        return "status-error";
      default:
        return "status-unknown";
    }
  };

  private renderRegisterSidebar = () => {
    const { isRegisterSidebarOpen, sections, presets, isLoadingRegisters } =
      this.state;
    const isConnected =
      this.context?.serialTerminal.connectionState ===
      ConnectionState.CONNECTED;

    return (
      <div
        className={`register-sidebar ${isRegisterSidebarOpen ? "open" : ""}`}
      >
        <button
          className="sidebar-toggle"
          onClick={() =>
            this.setState({ isRegisterSidebarOpen: !isRegisterSidebarOpen })
          }
        >
          {isRegisterSidebarOpen ? "◀" : "▶"}
        </button>
        <div className="sidebar-content">
          <div className="sidebar-header">
            <h2>Register Map</h2>
            <button
              onClick={this.readAllRegisters}
              disabled={!isConnected || isLoadingRegisters}
              className="btn-read-all"
            >
              {isLoadingRegisters ? "Reading..." : "Read All"}
            </button>
          </div>
          <div className="sidebar-registers">
            {sections.map((section) => (
              <div key={section.id} className="register-section">
                <h3>{section.name}</h3>
                {presets
                  .filter((p) => p.section === section.id)
                  .map((preset, index) => {
                    const presetIndex = this.state.presets.findIndex(
                      (p) => p.address === preset.address,
                    );
                    return (
                      <div
                        key={preset.address}
                        className="register-item"
                        title={preset.description}
                      >
                        <div className="register-info">
                          <span className="register-name">{preset.name}</span>
                          <span className="register-address">
                            {preset.address}
                          </span>
                        </div>
                        <div className="register-value-action">
                          <span className="register-value">
                            {preset.loading ? "..." : preset.value || "N/A"}
                          </span>
                          <button
                            onClick={() =>
                              this.readRegisterValue(preset, presetIndex)
                            }
                            disabled={!isConnected || preset.loading}
                            className="btn-read-single"
                          >
                            Read
                          </button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  render() {
    const {
      csrAddress,
      csrData,
      csrOperation,
      messages,
      autoScroll,
      selectedSection,
      sections,
      showRxAsHex,
      isRegisterSidebarOpen,
    } = this.state;
    const isConnected =
      this.context?.serialTerminal.connectionState ===
      ConnectionState.CONNECTED;
    const filteredPresets = this.getFilteredPresets();

    return (
      <div className="csr-page-container">
        {this.renderRegisterSidebar()}
        <div
          className={`csr-page ${isRegisterSidebarOpen ? "sidebar-open" : ""}`}
        >
          <div className="csr-header">
            <h1>CSR Control Panel</h1>
            <p className="description">
              Command Format: 9 bytes - CMD_TYPE(1) + ADDR(4) + DATA(4)
            </p>
          </div>
          <div className="csr-content">
            <div className="csr-left-panel">
              <div className="csr-controls">
                <h2>Command Builder</h2>
                <div
                  className={`connection-status-banner ${this.getConnectionStatusClass()}`}
                >
                  <span className="status-icon">
                    {isConnected ? "🔌" : "🔴"}
                  </span>
                  <span className="status-text">
                    {this.getConnectionStatusText()}
                  </span>
                  {!isConnected && (
                    <span className="status-hint">
                      → Go to Serial Terminal page to connect
                    </span>
                  )}
                </div>
                <div className="control-group">
                  <label>Operation:</label>
                  <div className="radio-group">
                    <label className="radio-label">
                      <input
                        type="radio"
                        value="WRITE"
                        checked={csrOperation === "WRITE"}
                        onChange={() =>
                          this.setState({ csrOperation: "WRITE" })
                        }
                      />
                      Write (0x00)
                    </label>
                    <label className="radio-label">
                      <input
                        type="radio"
                        value="READ"
                        checked={csrOperation === "READ"}
                        onChange={() => this.setState({ csrOperation: "READ" })}
                      />
                      Read (0x01)
                    </label>
                  </div>
                </div>
                <div className="control-group">
                  <label>Address (4 bytes):</label>
                  <input
                    type="text"
                    value={csrAddress}
                    onChange={(e) =>
                      this.setState({ csrAddress: e.target.value })
                    }
                    placeholder="0x10000"
                    className="hex-input"
                  />
                </div>
                {csrOperation === "WRITE" && (
                  <div className="control-group">
                    <label>Data (4 bytes):</label>
                    <input
                      type="text"
                      value={csrData}
                      onChange={(e) =>
                        this.setState({ csrData: e.target.value })
                      }
                      placeholder="0xDEADBEEF"
                      className="hex-input"
                    />
                  </div>
                )}
                <div className="control-group">
                  <button
                    onClick={this.sendCSRCommand}
                    className="btn-send"
                    disabled={!isConnected}
                    title={
                      !isConnected
                        ? "Connect serial port first"
                        : "Send CSR command via serial port"
                    }
                  >
                    📤 Send CSR Command
                  </button>
                </div>
              </div>
              <div className="preset-registers">
                <div className="preset-header">
                  <h2>Quick Access Registers</h2>
                  <select
                    className="section-selector"
                    value={selectedSection}
                    onChange={(e) =>
                      this.setState({ selectedSection: e.target.value })
                    }
                  >
                    <option value="all">
                      All Sections ({this.state.presets.length})
                    </option>
                    {sections.map((section) => {
                      const count = this.state.presets.filter(
                        (p) => p.section === section.id,
                      ).length;
                      return (
                        <option key={section.id} value={section.id}>
                          {section.name} ({count})
                        </option>
                      );
                    })}
                  </select>
                </div>
                <div className="preset-list">
                  {filteredPresets.map((preset, index) => (
                    <button
                      key={index}
                      className="preset-button"
                      onClick={() => this.loadPreset(preset)}
                      title={preset.description}
                    >
                      <div className="preset-name">{preset.name}</div>
                      <div className="preset-addr">{preset.address}</div>
                      <div className="preset-desc">{preset.description}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="csr-right-panel">
              <div className="message-log">
                <div className="log-header">
                  <h2>CSR Command Log</h2>
                  <div className="log-controls">
                    <label>
                      <input
                        type="checkbox"
                        checked={showRxAsHex}
                        onChange={(e) =>
                          this.setState({ showRxAsHex: e.target.checked })
                        }
                      />
                      Show RX as Hex
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        checked={autoScroll}
                        onChange={(e) =>
                          this.setState({ autoScroll: e.target.checked })
                        }
                      />
                      Auto-scroll
                    </label>
                    <button onClick={this.clearMessages} className="btn-clear">
                      Clear
                    </button>
                    <button onClick={this.exportLog} className="btn-export">
                      Export
                    </button>
                  </div>
                </div>
                <div className="log-content">
                  {messages.length === 0 && (
                    <div className="log-empty">
                      {isConnected
                        ? "No messages yet. Send a CSR command to get started."
                        : "Connect to serial port via Serial Terminal page to begin."}
                    </div>
                  )}
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`log-message ${msg.type.toLowerCase()}`}
                    >
                      <span className="log-timestamp">[{msg.timestamp}]</span>
                      <span className="log-type">{msg.type}:</span>
                      <span className="log-data">{msg.data}</span>
                    </div>
                  ))}
                  <div ref={this.terminalEndRef} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
}

const WrappedCSRPage = WithRouter(CSRPage);
export default WrappedCSRPage;
