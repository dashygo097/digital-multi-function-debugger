# Digital multi-function debugger

###### 2025秋嵌赛FPGA赛道源码

### 3rdparty intergration

```bash
git submodule update --init --recursive
```

### 使用上位机软件

###### 你需要安装node环境以及npm包管理器

In shell env:

```bash
cd frontend
npm install # 安装必要的modules

npm run start # run application
```

### Run AutoTestBench Script with Verilator and Gtkwave

##### For regular autotest impled in verilog:

- gtkwave (waveform visualization)
- verilator (generating executable files for testbench)
- fzf(optional)
- Only tested under unix-like os

In shell env:

```bash
cd scripts
bash tb.sh # or the corresponding script using fzf (tb_fzf.sh)
```

### README!!!

> You should put documents under docs/
> Put your sources files under src/ (hdl, dsl etc.)
> Put .bat or .sh or .tcl scripts under scritps/
