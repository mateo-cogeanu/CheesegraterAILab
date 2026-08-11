import json
import os
import pty
import tempfile
import threading
import unittest
from pathlib import Path

from fan_controller import SerialPort, curve_speed, load_config, read_hottest_temperature


CURVE = [
    {"temperatureC": 30, "speedPercent": 40},
    {"temperatureC": 50, "speedPercent": 50},
    {"temperatureC": 70, "speedPercent": 85},
    {"temperatureC": 80, "speedPercent": 100},
]


class FanControllerTests(unittest.TestCase):
    def test_interpolates_and_clamps_fan_curve(self):
        self.assertEqual(curve_speed(20, CURVE), 40)
        self.assertEqual(curve_speed(40, CURVE), 45)
        self.assertEqual(curve_speed(60, CURVE), 68)
        self.assertEqual(curve_speed(90, CURVE), 100)

    def test_reads_hottest_valid_sensor(self):
        with tempfile.TemporaryDirectory() as directory:
            Path(directory, "temp1_input").write_text("42000\n")
            Path(directory, "temp2_input").write_text("61000\n")
            Path(directory, "temp3_input").write_text("invalid\n")
            self.assertEqual(read_hottest_temperature(f"{directory}/temp*_input"), 61)

    def test_rejects_invalid_curve(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory, "config.json")
            path.write_text(json.dumps({"serialPort": "/dev/null", "curve": [CURVE[1], CURVE[0]]}))
            with self.assertRaisesRegex(ValueError, "strictly increasing"):
                load_config(str(path))

    def test_serial_protocol_requires_pong_and_sends_fan_command(self):
        master, slave = pty.openpty()
        slave_path = os.ttyname(slave)
        received = []

        def pico():
            buffer = b""
            while len(received) < 2:
                buffer += os.read(master, 1024)
                while b"\n" in buffer:
                    line, buffer = buffer.split(b"\n", 1)
                    received.append(line.decode())
                    if line == b"PING":
                        os.write(master, b"PONG\n")
                    elif line.startswith(b"FAN "):
                        os.write(master, b"FAN=" + line.removeprefix(b"FAN ") + b"\n")

        worker = threading.Thread(target=pico, daemon=True)
        worker.start()
        port = SerialPort(slave_path)
        try:
            port.open()
            port.require_pong()
            self.assertTrue(port.set_fan(73))
            worker.join(timeout=2)
        finally:
            port.close()
            os.close(master)
            os.close(slave)
        self.assertEqual(received, ["PING", "FAN 73"])


if __name__ == "__main__":
    unittest.main()
