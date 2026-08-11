#!/usr/bin/env python3
"""Headless temperature-based fan controller for a USB-connected microcontroller."""

from __future__ import annotations

import argparse
import fcntl
import glob
import json
import logging
import os
import select
import signal
import struct
import termios
import time
from pathlib import Path


LOG = logging.getLogger("cheesegrater-fan-control")
DEFAULT_CONFIG = "/etc/cheesegrater-fan-control/config.json"


class SerialPort:
    def __init__(self, path: str, baud_rate: int = 115200):
        self.path = path
        self.baud_rate = baud_rate
        self.fd: int | None = None
        self.buffer = bytearray()

    def open(self) -> None:
        if self.baud_rate != 115200:
            raise ValueError("Only 115200 baud is currently supported")
        self.fd = os.open(self.path, os.O_RDWR | os.O_NOCTTY | os.O_NONBLOCK)
        try:
            attributes = termios.tcgetattr(self.fd)
            attributes[0] = 0
            attributes[1] = 0
            attributes[2] = termios.CS8 | termios.CREAD | termios.CLOCAL
            attributes[3] = 0
            attributes[4] = termios.B115200
            attributes[5] = termios.B115200
            attributes[6][termios.VMIN] = 0
            attributes[6][termios.VTIME] = 0
            termios.tcsetattr(self.fd, termios.TCSANOW, attributes)
            try:
                modem_bits = termios.TIOCM_DTR | termios.TIOCM_RTS
                fcntl.ioctl(self.fd, termios.TIOCMBIS, struct.pack("I", modem_bits))
            except OSError:
                pass
            termios.tcflush(self.fd, termios.TCIOFLUSH)
        except Exception:
            self.close()
            raise

    def close(self) -> None:
        if self.fd is not None:
            try:
                os.close(self.fd)
            finally:
                self.fd = None
                self.buffer.clear()

    def write_line(self, value: str) -> None:
        if self.fd is None:
            raise OSError("Serial port is not open")
        payload = f"{value}\n".encode("ascii")
        view = memoryview(payload)
        while view:
            _, writable, _ = select.select([], [self.fd], [], 1.0)
            if not writable:
                raise TimeoutError("Timed out writing to the fan controller")
            written = os.write(self.fd, view)
            view = view[written:]

    def read_line(self, timeout: float) -> str | None:
        if self.fd is None:
            raise OSError("Serial port is not open")
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            if b"\n" in self.buffer:
                raw, _, remainder = self.buffer.partition(b"\n")
                self.buffer = bytearray(remainder)
                return raw.decode("utf-8", errors="ignore").strip()
            readable, _, _ = select.select([self.fd], [], [], max(0, deadline - time.monotonic()))
            if not readable:
                break
            chunk = os.read(self.fd, 4096)
            if chunk:
                self.buffer.extend(chunk)
        return None

    def require_pong(self, timeout: float = 2.0) -> None:
        time.sleep(0.5)
        self.write_line("PING")
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            line = self.read_line(max(0, deadline - time.monotonic()))
            if line == "PONG":
                return
        raise TimeoutError(f"No PONG received from {self.path}")

    def set_fan(self, speed: int, confirmation_timeout: float = 0.25) -> bool:
        speed = max(0, min(100, int(speed)))
        self.write_line(f"FAN {speed}")
        deadline = time.monotonic() + confirmation_timeout
        while time.monotonic() < deadline:
            line = self.read_line(max(0, deadline - time.monotonic()))
            if line and line.startswith("FAN="):
                return True
        return False


def load_config(path: str) -> dict:
    config = json.loads(Path(path).read_text(encoding="utf-8"))
    required = {"serialPort", "curve"}
    missing = required - config.keys()
    if missing:
        raise ValueError(f"Missing configuration keys: {', '.join(sorted(missing))}")
    curve = config["curve"]
    if len(curve) < 2:
        raise ValueError("Fan curve must contain at least two points")
    temperatures = [float(point["temperatureC"]) for point in curve]
    speeds = [int(point["speedPercent"]) for point in curve]
    if temperatures != sorted(temperatures) or len(set(temperatures)) != len(temperatures):
        raise ValueError("Fan curve temperatures must be strictly increasing")
    if any(speed < 0 or speed > 100 for speed in speeds):
        raise ValueError("Fan speeds must be between 0 and 100")
    if speeds != sorted(speeds):
        raise ValueError("Fan speeds must not decrease as temperature rises")
    return config


def curve_speed(temperature_c: float, curve: list[dict]) -> int:
    points = [(float(point["temperatureC"]), int(point["speedPercent"])) for point in curve]
    if temperature_c <= points[0][0]:
        return points[0][1]
    if temperature_c >= points[-1][0]:
        return points[-1][1]
    for (low_temp, low_speed), (high_temp, high_speed) in zip(points, points[1:]):
        if temperature_c <= high_temp:
            fraction = (temperature_c - low_temp) / (high_temp - low_temp)
            return round(low_speed + fraction * (high_speed - low_speed))
    return points[-1][1]


def read_hottest_temperature(search_pattern: str = "/sys/class/drm/card*/device/hwmon/hwmon*/temp*_input") -> float:
    temperatures = []
    for path in glob.glob(search_pattern):
        try:
            value = int(Path(path).read_text(encoding="ascii").strip()) / 1000
            if -20 <= value <= 200:
                temperatures.append(value)
        except (OSError, ValueError):
            continue
    if not temperatures:
        raise RuntimeError("No readable accelerator temperature sensors were found")
    return max(temperatures)


def probe(path: str) -> bool:
    port = SerialPort(path)
    try:
        port.open()
        port.require_pong()
        print(f"PONG {path}")
        return True
    except (OSError, TimeoutError, ValueError) as error:
        print(f"NO_PONG {path}: {error}")
        return False
    finally:
        port.close()


class FanController:
    def __init__(self, config: dict):
        self.config = config
        self.running = True
        self.port: SerialPort | None = None
        self.last_speed: int | None = None
        self.last_send = 0.0
        self.last_error: str | None = None

    def stop(self, _signum=None, _frame=None) -> None:
        self.running = False

    def connect(self) -> None:
        port = SerialPort(self.config["serialPort"], int(self.config.get("baudRate", 115200)))
        try:
            port.open()
            port.require_pong(float(self.config.get("connectionTimeoutSeconds", 2)))
            port.set_fan(int(self.config.get("failSafeSpeedPercent", 100)))
        except Exception:
            port.close()
            raise
        self.port = port
        self.last_speed = None
        self.last_send = 0
        LOG.info("Pico connected on %s; fail-safe fan speed sent", self.config["serialPort"])

    def disconnect(self) -> None:
        if self.port:
            self.port.close()
        self.port = None

    def send_speed(self, speed: int, temperature_c: float | None, force: bool = False) -> None:
        if not self.port:
            raise OSError("Pico is not connected")
        now = time.monotonic()
        minimum_change = int(self.config.get("minimumChangePercent", 2))
        resend_seconds = float(self.config.get("resendSeconds", 30))
        changed = self.last_speed is None or abs(speed - self.last_speed) >= minimum_change
        if force or changed or now - self.last_send >= resend_seconds:
            self.port.set_fan(speed)
            self.last_speed = speed
            self.last_send = now
            if temperature_c is None:
                LOG.warning("Temperature unavailable; commanded fail-safe fan speed %d%%", speed)
            else:
                LOG.info("Hottest accelerator sensor %.1f C; commanded fan speed %d%%", temperature_c, speed)

    def run(self) -> None:
        poll_seconds = float(self.config.get("pollSeconds", 5))
        reconnect_seconds = float(self.config.get("reconnectSeconds", 5))
        fail_safe = int(self.config.get("failSafeSpeedPercent", 100))
        while self.running:
            try:
                if not self.port:
                    self.connect()
                temperature_c = read_hottest_temperature(self.config.get("temperatureSensorGlob", "/sys/class/drm/card*/device/hwmon/hwmon*/temp*_input"))
                speed = curve_speed(temperature_c, self.config["curve"])
                self.send_speed(speed, temperature_c)
                self.last_error = None
                time.sleep(poll_seconds)
            except RuntimeError as error:
                if str(error) != self.last_error:
                    LOG.error("%s", error)
                    self.last_error = str(error)
                try:
                    self.send_speed(fail_safe, None, force=True)
                except OSError:
                    self.disconnect()
                time.sleep(poll_seconds)
            except (OSError, TimeoutError, ValueError) as error:
                if str(error) != self.last_error:
                    LOG.error("Fan controller communication failed: %s", error)
                    self.last_error = str(error)
                self.disconnect()
                time.sleep(reconnect_seconds)
        if self.port:
            try:
                self.port.set_fan(fail_safe)
                time.sleep(0.1)
                LOG.info("Service stopping; commanded fail-safe fan speed %d%%", fail_safe)
            except OSError as error:
                LOG.error("Could not send fail-safe speed during shutdown: %s", error)
            self.disconnect()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--config", default=DEFAULT_CONFIG)
    parser.add_argument("--probe", metavar="SERIAL_PORT")
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    if args.probe:
        return 0 if probe(args.probe) else 1
    controller = FanController(load_config(args.config))
    signal.signal(signal.SIGINT, controller.stop)
    signal.signal(signal.SIGTERM, controller.stop)
    controller.run()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
