## Put Sources Files Under This Directory

## List of Sections

| Name             | StartAddr | EndAddr   |
| ---------------- | --------- | --------- |
| `slv_regs`       | `0x10000` | `0x14000` |
| `slv_ram`        | `0x14000` | `0x18000` |
| `acm2108`        | `0x18000` | `0x1C000` |
| `signal_measure` | `0x1C000` | `0x20000` |
| `bitseq`         | `0x20000` | `0x24000` |
| `uart_engine`    | `0x24000` | `0x28000` |
| `spi_engine`     | `0x28000` | `0x2C000` |
| `pwm_engine`     | `0x2C000` | `0x30000` |
| `i2c_engines`    | `0x30000` | `0x34000` |

## List of Registers

### Section: `slv_regs(0x10000 - 0x14000)`

| Name       | Offset   | Func               |
| ---------- | -------- | ------------------ |
| `SLV_REG0` | `0x0000` | `[31:0]: slv_reg0` |
| `SLV_REG1` | `0x1000` | `[31:0]: slv_reg1` |
| `SLV_REG2` | `0x2000` | `[31:0]: slv_reg2` |
| `SLV_REG3` | `0x3000` | `[31:0]: slv_reg3` |

### Section: `slv_ram(0x14000 - 0x18000)`

| Name         | Offset      | Func               |
| ------------ | ----------- | ------------------ |
| `RAM_REGION` | `0x00-0x20` | `[31:0]: ram_data` |

| Name       | Offset   | Func               |
| ---------- | -------- | ------------------ |
| `SLV_REG0` | `0x0000` | `[31:0]: slv_reg0` |
| `SLV_REG1` | `0x1000` | `[31:0]: slv_reg1` |
| `SLV_REG2` | `0x2000` | `[31:0]: slv_reg2` |
| `SLV_REG3` | `0x3000` | `[31:0]: slv_reg3` |

### Section: `acm2108(0x18000 - 0x1C000)`

| Name           | Offset | Func                                                         |
| -------------- | ------ | ------------------------------------------------------------ |
| `CONTROL`      | `0x00` | `[0]: restart_req` - System restart request                  |
| `STATUS`       | `0x04` | `[1]: ddr_init, [0]: pll_locked` - System status (read only) |
| `CHANNEL_SEL`  | `0x08` | `[7:0]: channel_sel` - ADC channel selection                 |
| `DATA_NUM`     | `0x0C` | `[31:0]: data_num` - Number of data samples to capture       |
| `ADC_SPEED`    | `0x10` | `[31:0]: adc_speed` - ADC sampling speed configuration       |
| `RESTART`      | `0x14` | `[0]: restart_req` - ADC restart request (auto-clear)        |
| `DDS_CONTROL`  | `0x18` | `[0]: dds_restart` - DDS restart control (auto-clear)        |
| `DDS_WAVE_SEL` | `0x1C` | `[2:0]: wave_sel` - DDS waveform selection (0-7)             |
| `DDS_FTW`      | `0x20` | `[31:0]: ftw` - DDS Frequency Tuning Word                    |
| `DDR_STATUS`   | `0x24` | `[0]: ddr_init` - DDR3 initialization status (read only)     |

### Section: `signal_measure(0x1C000 - 0x20000)`

| Name        | Offset | Func                                                      |
| ----------- | ------ | --------------------------------------------------------- |
| `CONTROL`   | `0x00` | `[0]: enable` - Enable signal measurement                 |
| `STATUS`    | `0x04` | `[0]: busy, [1]: finish` - Measurement status (read only) |
| `PERIOD`    | `0x08` | `[25:0]: period_out` - Measured period (read only)        |
| `HIGH_TIME` | `0x0C` | `[19:0]: high_time` - Measured high time (read only)      |

### Section: `bitseq(0x20000 - 0x24000)`

#### CSR

| Name         | Offset | Func                                                             |
| ------------ | ------ | ---------------------------------------------------------------- |
| `CONTROL`    | `0x00` | `[0]: sync_enable, [1]: arm_load, [2]: group_start` (auto-clear) |
| `STATUS`     | `0x04` | `[7:0]: playing` - Channel playing status (read only)            |
| `ARM_MASK`   | `0x08` | `[7:0]: arm_mask_in` - Channel arm mask for sync start           |
| `START_CH`   | `0x0C` | `[7:0]: start_ch_bus` - Individual channel start (auto-clear)    |
| `STOP_CH`    | `0x10` | `[7:0]: stop_ch_bus` - Individual channel stop (auto-clear)      |
| `WR_CONTROL` | `0x14` | `[2:0]: wr_ch, [7]: wr_en` - Write control                       |
| `WR_ADDR`    | `0x18` | `[7:0]: wr_addr` - Write address for sequence memory             |
| `WR_DATA`    | `0x1C` | `[0]: wr_bit` - Write data bit                                   |

#### Channel Configuration Registers (Ch0-Ch7)

| Name            | Offset | Func                                         |
| --------------- | ------ | -------------------------------------------- |
| `LEN_CH0`       | `0x20` | `[31:0]: len` - Channel 0 sequence length    |
| `LEN_CH1`       | `0x24` | `[31:0]: len` - Channel 1 sequence length    |
| `LEN_CH2`       | `0x28` | `[31:0]: len` - Channel 2 sequence length    |
| `LEN_CH3`       | `0x2C` | `[31:0]: len` - Channel 3 sequence length    |
| `LEN_CH4`       | `0x30` | `[31:0]: len` - Channel 4 sequence length    |
| `LEN_CH5`       | `0x34` | `[31:0]: len` - Channel 5 sequence length    |
| `LEN_CH6`       | `0x38` | `[31:0]: len` - Channel 6 sequence length    |
| `LEN_CH7`       | `0x3C` | `[31:0]: len` - Channel 7 sequence length    |
| `RATE_DIV_CH0`  | `0x40` | `[31:0]: rate_div` - Channel 0 rate divider  |
| `RATE_DIV_CH1`  | `0x44` | `[31:0]: rate_div` - Channel 1 rate divider  |
| `RATE_DIV_CH2`  | `0x48` | `[31:0]: rate_div` - Channel 2 rate divider  |
| `RATE_DIV_CH3`  | `0x4C` | `[31:0]: rate_div` - Channel 3 rate divider  |
| `RATE_DIV_CH4`  | `0x50` | `[31:0]: rate_div` - Channel 4 rate divider  |
| `RATE_DIV_CH5`  | `0x54` | `[31:0]: rate_div` - Channel 5 rate divider  |
| `RATE_DIV_CH6`  | `0x58` | `[31:0]: rate_div` - Channel 6 rate divider  |
| `RATE_DIV_CH7`  | `0x5C` | `[31:0]: rate_div` - Channel 7 rate divider  |
| `PHASE_OFF_CH0` | `0x60` | `[31:0]: phase_off` - Channel 0 phase offset |
| `PHASE_OFF_CH1` | `0x64` | `[31:0]: phase_off` - Channel 1 phase offset |
| `PHASE_OFF_CH2` | `0x68` | `[31:0]: phase_off` - Channel 2 phase offset |
| `PHASE_OFF_CH3` | `0x6C` | `[31:0]: phase_off` - Channel 3 phase offset |
| `PHASE_OFF_CH4` | `0x70` | `[31:0]: phase_off` - Channel 4 phase offset |
| `PHASE_OFF_CH5` | `0x74` | `[31:0]: phase_off` - Channel 5 phase offset |
| `PHASE_OFF_CH6` | `0x78` | `[31:0]: phase_off` - Channel 6 phase offset |
| `PHASE_OFF_CH7` | `0x7C` | `[31:0]: phase_off` - Channel 7 phase offset |

### Section: `uart_engine(0x24000 - 0x28000)`

| Name          | Offset | Func                                        |
| ------------- | ------ | ------------------------------------------- |
| `CONFIG`      | `0x00` | `[31:0]: clk_div`                           |
| `PARITY_CFG`  | `0x04` | `[0]: check_en, [2:1]: check_type`          |
| `FRAME_CFG`   | `0x08` | `[1:0]: data_bit, [3:2]: stop_bit`          |
| `TX_DATA`     | `0x10` | `[7:0]: tx_fifo_data`                       |
| `TX_CONTROL`  | `0x14` | `[0]: tx_fifo_valid (write 1 to push)`      |
| `RX_DATA`     | `0x20` | `[7:0]: rx_fifo_data (read only)`           |
| `RX_CONTROL`  | `0x24` | `[0]: rx_fifo_ready (write 1 to pop)`       |
| `STATUS`      | `0x30` | `[0]: tx_busy, [1]: rx_busy, [2]: rx_error` |
| `TX_COUNT`    | `0x34` | `[15:0]: tx_byte_count`                     |
| `RX_COUNT`    | `0x38` | `[15:0]: rx_byte_count`                     |
| `FIFO_STATUS` | `0x3C` | `[0]: tx_fifo_ready, [1]: rx_fifo_valid`    |

### Section: `spi_engine(0x28000 - 0x2C000)`

| Name          | Offset | Func                                                      |
| ------------- | ------ | --------------------------------------------------------- |
| `CONFIG`      | `0x00` | `[31:0]: clk_div`                                         |
| `CONTROL`     | `0x04` | `[0]: spi_enable, [2:1]: spi_mode, [3]: spi_msb_first`    |
| `TX_DATA`     | `0x10` | `[7:0]: tx_fifo_data`                                     |
| `TX_CONTROL`  | `0x14` | `[0]: tx_fifo_valid (write 1 to push)`                    |
| `RX_DATA`     | `0x20` | `[7:0]: rx_fifo_data (read only)`                         |
| `RX_CONTROL`  | `0x24` | `[0]: rx_fifo_ready (write 1 to pop)`                     |
| `STATUS`      | `0x30` | `[0]: spi_busy, [1]: spi_mosi_oe`                         |
| `TX_COUNT`    | `0x34` | `[15:0]: spi_tx_count`                                    |
| `RX_COUNT`    | `0x38` | `[15:0]: spi_rx_count`                                    |
| `FIFO_STATUS` | `0x3C` | `[0]: tx_fifo_ready, [1]: rx_fifo_valid`                  |
| `PIN_STATUS`  | `0x40` | `[0]: spi_sck, [1]: spi_mosi, [2]: spi_miso, [3]: spi_cs` |

### Section `pwm_engine(0x2C000 - 0x30000)`

| Name             | Offset | Func                                                        |
| ---------------- | ------ | ----------------------------------------------------------- |
| `CONTROL`        | `0x00` | `[0]: pwm_enable, [8:1]: pwm_channel_enable`                |
| `CHANNEL_SEL`    | `0x04` | `[2:0]: channel_config` - Select channel to configure       |
| `HIGH_COUNT`     | `0x08` | `[31:0]: pwm_high_count` - High period for selected ch      |
| `LOW_COUNT`      | `0x0C` | `[31:0]: pwm_low_count` - Low period for selected ch        |
| `CONFIG_SET`     | `0x10` | `[0]: config_set` - Write 1 to apply (auto-clear)           |
| `PWM_OUTPUT`     | `0x14` | `[7:0]: pwm_out` - Current PWM output states (read only)    |
| `CHANNEL_STATUS` | `0x18` | `[7:0]: channel_enable` - Channel enable status (read only) |

### Section: `i2c_engine(0x30000 - 0x34000)`

| Name           | Offset | Func                                                               |
| -------------- | ------ | ------------------------------------------------------------------ |
| `CONFIG`       | `0x00` | `[31:0]: clk_div`                                                  |
| `CONTROL`      | `0x04` | `[0]: i2c_enable, [1]: master_mode, [2]: 10bit_addr, [3]: restart` |
| `DEVICE_ADDR`  | `0x08` | `[9:0]: i2c_dev_addr (7-bit or 10-bit)`                            |
| `TRANSFER_CFG` | `0x0C` | `[7:0]: tx_count, [15:8]: rx_count, [31]: start`                   |
| `TX_DATA`      | `0x10` | `[7:0]: tx_fifo_data`                                              |
| `TX_CONTROL`   | `0x14` | `[0]: tx_fifo_valid (write 1 to push)`                             |
| `RX_DATA`      | `0x20` | `[7:0]: rx_fifo_data (read only)`                                  |
| `RX_CONTROL`   | `0x24` | `[0]: rx_fifo_ready (write 1 to pop)`                              |
| `STATUS`       | `0x30` | `[0]: busy, [1]: done, [2]: ack_error`                             |
| `COUNT_STATUS` | `0x34` | `[7:0]: tx_count_remaining, [15:8]: rx_count_remaining`            |
| `FIFO_STATUS`  | `0x38` | `[0]: tx_fifo_ready, [1]: rx_fifo_valid`                           |

### Section: `dac_engine(0x34000 - 0x38000)`

| Name           | Offset | Function                                                |
| -------------- | ------ | ------------------------------------------------------- |
| `CONTROL`      | `0x00` | `[0]: dds_enable, [1]: high_quality_mode`               |
| `FREQUENCY`    | `0x04` | `[31:0]: frequency_control_word`                        |
| `AMPLITUDE`    | `0x08` | `[15:0]: amplitude_scale (0x0000-0xFFFF)`               |
| `PHASE_OFFSET` | `0x0C` | `[15:0]: phase_offset (0x0000-0xFFFF)`                  |
| `WAVE_ADDR`    | `0x10` | `[8:0]: waveform_memory_address (0-511)`                |
| `WAVE_DATA`    | `0x14` | `[15:0]: waveform_data_value (signed)`                  |
| `WAVE_WR_EN`   | `0x18` | `[0]: wave_write_enable (write 1 to push, auto-clears)` |
| `DAC_OUTPUT`   | `0x1C` | `[15:0]: current_dac_output_value (real-time)`          |
| `STATUS`       | `0x20` | `[0]: engine_running, [1]: high_quality_active`         |
