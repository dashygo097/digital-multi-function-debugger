## Put Sources Files Under This Directory

## List of Sections

| Name             | StartAddr | EndAddr   |
| ---------------- | --------- | --------- |
| `测试用寄存器`   | `0x10000` | `0x14000` |
| `测试用RAM`      | `0x14000` | `0x18000` |
| `acm2108`        | `0x18000` | `0x1C000` |
| `signal_measure` | `0x1C000` | `0x20000` |
| `bitseq`         | `0x20000` | `0x24000` |
| `uart_engine`    | `0x24000` | `0x28000` |
| `spi_engine`     | `0x28000` | `0x2C000` |
| `pwm_engine`     | `0x2C000` | `0x30000` |
| `i2c_engines`    | `0x30000` | `0x34000` |

## List of Registers

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

| Name             | Offset | Func                                                         |
| ---------------- | ------ | ------------------------------------------------------------ |
| `CONTROL`        | `0x00` | `[0]: pwm_enable, [8:1]: pwm_channel_enable`                 |
| `CONFIG_CHANNEL` | `0x04` | `[2:0]: channel_config, [31]: config_set (write 1 to apply)` |
| `HIGH_COUNT`     | `0x10` | `[31:0]: pwm_high_count`                                     |
| `LOW_COUNT`      | `0x14` | `[31:0]: pwm_low_count`                                      |
| `CH0_HIGH_COUNT` | `0x20` | `[31:0]: ch0_high_count`                                     |
| `CH0_LOW_COUNT`  | `0x24` | `[31:0]: ch0_low_count`                                      |
| `CH0_PERIOD`     | `0x28` | `[31:0]: high_count + low_count (read-only)`                 |
| `CH0_COUNTER`    | `0x2C` | `[31:0]: current counter value (read-only)`                  |
| `CH1_HIGH_COUNT` | `0x30` | `[31:0]: ch1_high_count`                                     |
| `CH1_LOW_COUNT`  | `0x34` | `[31:0]: ch1_low_count`                                      |
| `CH1_PERIOD`     | `0x38` | `[31:0]: high_count + low_count (read-only)`                 |
| `CH1_COUNTER`    | `0x3C` | `[31:0]: current counter value (read-only)`                  |
| `CH2_HIGH_COUNT` | `0x40` | `[31:0]: ch2_high_count`                                     |
| `CH2_LOW_COUNT`  | `0x44` | `[31:0]: ch2_low_count`                                      |
| `CH2_PERIOD`     | `0x48` | `[31:0]: high_count + low_count (read-only)`                 |
| `CH2_COUNTER`    | `0x4C` | `[31:0]: current counter value (read-only)`                  |
| `CH3_HIGH_COUNT` | `0x50` | `[31:0]: ch3_high_count`                                     |
| `CH3_LOW_COUNT`  | `0x54` | `[31:0]: ch3_low_count`                                      |
| `CH3_PERIOD`     | `0x58` | `[31:0]: high_count + low_count (read-only)`                 |
| `CH3_COUNTER`    | `0x5C` | `[31:0]: current counter value (read-only)`                  |
| `CH4_HIGH_COUNT` | `0x60` | `[31:0]: ch4_high_count`                                     |
| `CH4_LOW_COUNT`  | `0x64` | `[31:0]: ch4_low_count`                                      |
| `CH4_PERIOD`     | `0x68` | `[31:0]: high_count + low_count (read-only)`                 |
| `CH4_COUNTER`    | `0x6C` | `[31:0]: current counter value (read-only)`                  |
| `CH5_HIGH_COUNT` | `0x70` | `[31:0]: ch5_high_count`                                     |
| `CH5_LOW_COUNT`  | `0x74` | `[31:0]: ch5_low_count`                                      |
| `CH5_PERIOD`     | `0x78` | `[31:0]: high_count + low_count (read-only)`                 |
| `CH5_COUNTER`    | `0x7C` | `[31:0]: current counter value (read-only)`                  |
| `CH6_HIGH_COUNT` | `0x80` | `[31:0]: ch6_high_count`                                     |
| `CH6_LOW_COUNT`  | `0x84` | `[31:0]: ch6_low_count`                                      |
| `CH6_PERIOD`     | `0x88` | `[31:0]: high_count + low_count (read-only)`                 |
| `CH6_COUNTER`    | `0x8C` | `[31:0]: current counter value (read-only)`                  |
| `CH7_HIGH_COUNT` | `0x90` | `[31:0]: ch7_high_count`                                     |
| `CH7_LOW_COUNT`  | `0x94` | `[31:0]: ch7_low_count`                                      |
| `CH7_PERIOD`     | `0x98` | `[31:0]: high_count + low_count (read-only)`                 |
| `CH7_COUNTER`    | `0x9C` | `[31:0]: current counter value (read-only)`                  |
| `PWM_OUTPUT`     | `0xA0` | `[7:0]: current PWM output states (read-only)`               |
| `CHANNEL_STATUS` | `0xA4` | `[7:0]: channel enable status (read-only)`                   |

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
