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
