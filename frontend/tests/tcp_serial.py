import json
import random
import socket
import threading
import time
from datetime import datetime


class TCPSimulator:
    def __init__(self, host="localhost", port=8888):
        self.host = host
        self.port = port
        self.server_socket = None
        self.client_socket = None
        self.running = False

    def generate_data(self):
        data = {
            "timestamp": datetime.now().isoformat(),
            "data": random.randint(0, 100),
            "connection_type": "TCP",
        }
        return json.dumps(data)

    def handle_client(self, client_socket, address):
        print(f"Client connected: {address}")

        try:
            while self.running:
                data = self.generate_data()
                message = data + "\n"

                client_socket.send(message.encode("utf-8"))
                print(f"Send to {address}: {data}")

                time.sleep(2)

        except (ConnectionResetError, BrokenPipeError):
            print(f"Client {address} disconnected")
        except Exception as e:
            print(f"Err dealing with client: {e}")
        finally:
            client_socket.close()

    def start_server(self):
        try:
            self.server_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            self.server_socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            self.server_socket.bind((self.host, self.port))
            self.server_socket.listen(1)

            print("TCP simulator started")
            print(f"Listening to port: {self.host}:{self.port}")
            print("Waiting for connection...")

            self.running = True

            while self.running:
                try:
                    client_socket, address = self.server_socket.accept()

                    client_thread = threading.Thread(
                        target=self.handle_client, args=(client_socket, address)
                    )
                    client_thread.daemon = True
                    client_thread.start()

                except OSError:
                    break

        except Exception as e:
            print(f"Error starting server: {e}")
        finally:
            self.stop()

    def stop(self):
        self.running = False
        if self.server_socket:
            self.server_socket.close()
        print("TCP server closed")


def main():
    host = input("Enter host (default: localhost): ") or "localhost"

    try:
        port = int(input("Enter port (default: 8888): ") or "8888")
    except ValueError:
        port = 8888

    simulator = TCPSimulator(host, port)

    try:
        simulator.start_server()
    except KeyboardInterrupt:
        print("\nClosing server...")
        simulator.stop()


if __name__ == "__main__":
    main()
