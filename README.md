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

###### 稍后会release Windows/Linux/MacOS 各自的distribution, 当然你也可以手动完成(e.g. Linux/MacOS)：

```bash
cd frontend
npm install # 安装必要的modules

npm run make # will make a zip distributable for your platform.
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

##### NOTE: You should put your testbenchs under testbenchs/ (or you might want to change the shell scirpts of $TB_DIR)

### README!!!

> You should put documents under docs/ <br/>
> Put your sources files under src/ (hdl, dsl etc.) <br/>
> Put .bat or .sh or .tcl scripts under scritps/
