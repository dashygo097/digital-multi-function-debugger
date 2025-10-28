#!/usr/bin/env python3
import socket
import sys
import threading
import time
from datetime import datetime


class UDPSimulator:
    def __init__(self, host="0.0.0.0", port=9999):
        self.host = host
        self.port = port
        self.sock = None
        self.running = False
        self.client_address = None

        self.packets_received = 0
        self.packets_sent = 0
        self.uptime_start = time.time()

        self.registers = {
            "TEMP": 45.5,
            "VOLTAGE": 3.3,
            "CURRENT": 0.5,
            "STATUS": 0xA5A5,
        }

    def start(self):
        try:
            self.sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            self.sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            self.sock.bind((self.host, self.port))
            self.running = True

            print("Listening for UDP packets...")
            print("Configure your UDP Terminal:")
            print("  - Local Port: 8888 (or any)")
            print("  - FPGA IP: 127.0.0.1 (or localhost)")
            print(f"  - FPGA Port: {self.port}")
            print("\nWaiting for connections...\n")

            status_thread = threading.Thread(
                target=self.status_broadcaster, daemon=True
            )
            status_thread.start()

            self.receive_loop()

        except KeyboardInterrupt:
            print("\n\nShutting down...")
            self.stop()
        except Exception as e:
            print(f"Error: {e}")
            self.stop()

    def receive_loop(self):
        self.sock.settimeout(0.1)

        while self.running:
            try:
                data, addr = self.sock.recvfrom(4096)
                self.packets_received += 1

                if self.client_address != addr:
                    self.client_address = addr
                    print(f"New client connected: {addr[0]}:{addr[1]}\n")

                self.process_packet(data, addr)

            except socket.timeout:
                continue
            except Exception as e:
                if self.running:
                    print(f"Receive error: {e}")

    def process_packet(self, data, addr):
        timestamp = datetime.now().strftime("%H:%M:%S.%f")[:-3]

        try:
            text = data.decode("utf-8").strip()
            hex_str = " ".join([f"{b:02x}" for b in data])

            print(f"[{timestamp}] RX from {addr[0]}:{addr[1]}")
            print(f"  Text: '{text}'")
            print(f"  Hex:  {hex_str}")
            print(f"  Size: {len(data)} bytes\n")

            response = self.handle_command(text)

            if response:
                self.send_response(response, addr)
            else:
                print(f"  No response generated for command: '{text}'")

        except UnicodeDecodeError:
            hex_str = " ".join([f"{b:02x}" for b in data])
            print(f"[{timestamp}] RX (Binary) from {addr[0]}:{addr[1]}")
            print(f"  Hex:  {hex_str}")
            print(f"  Size: {len(data)} bytes\n")

            self.send_response(data, addr)

    def handle_command(self, cmd):
        cmd_upper = cmd.upper().strip()

        print(f"  Processing command: '{cmd_upper}' (len={len(cmd_upper)})")

        if cmd_upper == "PING":
            print("  Matched PING command")
            return "PONG"

        elif cmd_upper == "STATUS":
            uptime = int(time.time() - self.uptime_start)
            return f"STATUS: OK | Uptime: {uptime}s | RX: {self.packets_received} | TX: {self.packets_sent}"

        elif cmd_upper.startswith("READ"):
            parts = cmd_upper.split()
            if len(parts) == 2:
                reg = parts[1]
                if reg in self.registers:
                    value = self.registers[reg]
                    return f"{reg}={value}"
                else:
                    return f"ERROR: Unknown register {reg}"
            else:
                return "ERROR: Usage: READ <register>"

        elif cmd_upper.startswith("WRITE"):
            parts = cmd.split()
            if len(parts) == 3:
                reg = parts[1].upper()
                try:
                    value = float(parts[2])
                    self.registers[reg] = value
                    return f"OK: {reg}={value}"
                except ValueError:
                    return f"ERROR: Invalid value {parts[2]}"
            else:
                return "ERROR: Usage: WRITE <register> <value>"

        elif cmd_upper == "HELP":
            help_text = """Available Commands:
  PING          - Test connectivity
  STATUS        - Get system status
  READ <reg>    - Read register (TEMP, VOLTAGE, CURRENT, STATUS)
  WRITE <reg> <val> - Write register
  HELP          - Show this help
  RESET         - Reset statistics"""
            return help_text

        elif cmd_upper == "RESET":
            self.packets_received = 0
            self.packets_sent = 0
            self.uptime_start = time.time()
            return "OK: Statistics reset"

        else:
            print("  Unknown command, echoing back")
            return f"ECHO: {cmd}"

    def send_response(self, data, addr):
        if isinstance(data, str):
            data = data.encode("utf-8")

        try:
            sent_bytes = self.sock.sendto(data, addr)
            self.packets_sent += 1

            timestamp = datetime.now().strftime("%H:%M:%S.%f")[:-3]
            try:
                text = data.decode("utf-8")
                print(f"[{timestamp}] TX to {addr[0]}:{addr[1]}")
                print(f"  Text: '{text}'")
                print(f"  Size: {len(data)} bytes (sent: {sent_bytes})\n")
            except UnicodeDecodeError:
                hex_str = " ".join([f"{b:02x}" for b in data])
                print(f"[{timestamp}] TX (Binary) to {addr[0]}:{addr[1]}")
                print(f"  Hex:  {hex_str}")
                print(f"  Size: {len(data)} bytes (sent: {sent_bytes})\n")

        except Exception as e:
            print(f"Send error: {e}")
            import traceback

            traceback.print_exc()

    def status_broadcaster(self):
        while self.running:
            time.sleep(10)

            if self.client_address:
                self.registers["TEMP"] += (time.time() % 1) - 0.5
                self.registers["CURRENT"] = 0.5 + 0.1 * (time.time() % 1)

                status_msg = f"[AUTO] TEMP={self.registers['TEMP']:.1f}°C | V={self.registers['VOLTAGE']:.2f}V | I={self.registers['CURRENT']:.3f}A"
                self.send_response(status_msg, self.client_address)

    def stop(self):
        self.running = False
        if self.sock:
            self.sock.close()
        print("✓ Server stopped")


if __name__ == "__main__":
    host = "localhost"
    port = 9999

    if len(sys.argv) > 1:
        port = int(sys.argv[1])
    if len(sys.argv) > 2:
        host = sys.argv[2]

    simulator = UDPSimulator(host, port)
    simulator.start()
    simulator.stop()
