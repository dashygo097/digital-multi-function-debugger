#!/bin/bash

BASE_DIR=$(dirname $(cd "$(dirname "$0")" && pwd))
SCRIPT_DIR=$BASE_DIR/scripts
BRIDGE_DIR=$BASE_DIR/udp_bridge

touch "$BASE_DIR/udp_simulator.log" 2>&1
touch "$BASE_DIR/udp_bridge.log" 2>&1

python3 "$SCRIPT_DIR/udp_simulator.py" > "$BASE_DIR/udp_simulator.log" 2>&1 &
npm run udp > "$BASE_DIR/udp_bridge.log" 2>&1 &
npm run start 
