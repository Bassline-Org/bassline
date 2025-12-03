#!/usr/bin/env python3
"""
BL/T Protocol Client - Zero Dependencies

A simple BL/T client using only Python standard library.

Usage:
    python client.py                         # Interactive mode
    python client.py read counter            # Read bl:///cell/counter
    python client.py write counter 42        # Write to bl:///cell/counter
    python client.py fold sum a,b,c          # Read sum fold
    python client.py subscribe counter       # Subscribe to changes
"""

import json
import os
import socket
import sys
from typing import Optional, Iterator


class BLTClient:
    """BL/T Protocol Client"""

    def __init__(self, host: str = "localhost", port: int = 9000):
        self.host = host
        self.port = port
        self._sock: Optional[socket.socket] = None
        self._buffer = ""

    def connect(self):
        """Connect to BL/T server."""
        self._sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self._sock.connect((self.host, self.port))

    def close(self):
        """Close connection."""
        if self._sock:
            self._sock.close()
            self._sock = None

    def _send(self, msg: str):
        """Send a message."""
        if not self._sock:
            self.connect()
        self._sock.sendall((msg + "\n").encode())

    def _recv_line(self) -> str:
        """Receive a single line."""
        while "\n" not in self._buffer:
            data = self._sock.recv(4096).decode()
            if not data:
                raise ConnectionError("Connection closed")
            self._buffer += data

        line, self._buffer = self._buffer.split("\n", 1)
        return line

    def _request(self, cmd: str) -> str:
        """Send request and get response."""
        # For simple requests, create a new connection
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.connect((self.host, self.port))
        sock.sendall((cmd + "\n").encode())
        response = b""
        while True:
            chunk = sock.recv(4096)
            if not chunk:
                break
            response += chunk
            if b"\n" in response:
                break
        sock.close()
        return response.decode().strip().split("\n")[0]

    def _parse_response(self, resp: str) -> tuple:
        """Parse response into (ok, value_or_error)."""
        if resp.startswith("OK"):
            value = resp[3:].strip() if len(resp) > 2 else None
            # Remove tag if present
            if value and " @" in value:
                value = value.rsplit(" @", 1)[0]
            return True, value
        elif resp.startswith("ERROR"):
            return False, resp[6:].strip()
        else:
            return False, resp

    def version(self) -> str:
        """Negotiate protocol version."""
        resp = self._request("VERSION BL/1.0")
        return resp

    def read(self, ref: str) -> Optional[str]:
        """Read a value from a ref."""
        if not ref.startswith("bl://"):
            ref = f"bl:///cell/{ref}"
        resp = self._request(f"READ {ref}")
        ok, value = self._parse_response(resp)
        if ok:
            return self._parse_value(value) if value else None
        raise Exception(value)

    def write(self, ref: str, value) -> bool:
        """Write a value to a ref."""
        if not ref.startswith("bl://"):
            ref = f"bl:///cell/{ref}"
        encoded = self._encode_value(value)
        resp = self._request(f"WRITE {ref} {encoded}")
        ok, _ = self._parse_response(resp)
        return ok

    def info(self, ref: str) -> dict:
        """Get mirror capabilities."""
        if not ref.startswith("bl://"):
            ref = f"bl:///cell/{ref}"
        resp = self._request(f"INFO {ref}")
        ok, value = self._parse_response(resp)
        if ok:
            return json.loads(value)
        raise Exception(value)

    def fold(self, fold_type: str, sources: list) -> Optional[str]:
        """Read a fold over multiple sources."""
        refs = []
        for src in sources:
            if not src.startswith("bl://"):
                src = f"bl:///cell/{src}"
            refs.append(src)
        sources_param = ",".join(refs)
        return self.read(f"bl:///fold/{fold_type}?sources={sources_param}")

    def subscribe(self, ref: str) -> Iterator[tuple]:
        """
        Subscribe to changes on a ref.
        Yields (event_type, value) tuples.
        """
        if not ref.startswith("bl://"):
            ref = f"bl:///cell/{ref}"

        self.connect()
        self._send(f"SUBSCRIBE {ref}")

        while True:
            line = self._recv_line()
            if line.startswith("EVENT"):
                parts = line.split(" ", 2)
                stream_id = parts[1]
                value = parts[2] if len(parts) > 2 else None
                yield ("event", self._parse_value(value))
            elif line.startswith("STREAM"):
                parts = line.split(" ", 2)
                stream_id = parts[1]
                yield ("stream", stream_id)
            elif line.startswith("ERROR"):
                raise Exception(line[6:].strip())

    def _encode_value(self, value) -> str:
        """Encode a Python value for BL/T."""
        if value is None:
            return "null"
        if isinstance(value, bool):
            return "true" if value else "false"
        if isinstance(value, (int, float)):
            return str(value)
        if isinstance(value, str):
            if " " in value or '"' in value or "{" in value or "[" in value:
                return json.dumps(value)
            return value
        return json.dumps(value)

    def _parse_value(self, value: str):
        """Parse a BL/T value to Python."""
        if value is None:
            return None
        value = value.strip()
        if value == "null":
            return None
        if value == "true":
            return True
        if value == "false":
            return False
        if value.startswith("{") or value.startswith("[") or value.startswith('"'):
            return json.loads(value)
        try:
            if "." in value:
                return float(value)
            return int(value)
        except ValueError:
            return value


def interactive(client: BLTClient):
    """Interactive mode."""
    print(f"BL/T Client - {client.host}:{client.port}")
    print("Commands: read <ref>, write <ref> <value>, fold <type> <sources>, info <ref>, quit")
    print()

    while True:
        try:
            line = input("> ").strip()
        except (EOFError, KeyboardInterrupt):
            print()
            break

        if not line:
            continue

        parts = line.split(None, 2)
        cmd = parts[0].lower()

        try:
            if cmd == "read" and len(parts) >= 2:
                result = client.read(parts[1])
                print(result)
            elif cmd == "write" and len(parts) >= 3:
                client.write(parts[1], parts[2])
                print("ok")
            elif cmd == "fold" and len(parts) >= 3:
                sources = parts[2].split(",")
                result = client.fold(parts[1], sources)
                print(result)
            elif cmd == "info" and len(parts) >= 2:
                result = client.info(parts[1])
                print(json.dumps(result))
            elif cmd == "subscribe" and len(parts) >= 2:
                print("Subscribing... (Ctrl+C to stop)")
                for event_type, value in client.subscribe(parts[1]):
                    print(f"{event_type}: {value}")
            elif cmd in ("quit", "exit", "q"):
                break
            else:
                print(f"Unknown command: {cmd}")
        except Exception as e:
            print(f"Error: {e}")


def main():
    host = os.environ.get("BLT_HOST", "localhost")
    port = int(os.environ.get("BLT_PORT", "9000"))
    client = BLTClient(host, port)

    if len(sys.argv) < 2:
        interactive(client)
        return

    cmd = sys.argv[1].lower()

    try:
        if cmd == "read" and len(sys.argv) >= 3:
            result = client.read(sys.argv[2])
            print(result)
        elif cmd == "write" and len(sys.argv) >= 4:
            client.write(sys.argv[2], sys.argv[3])
            print("ok")
        elif cmd == "fold" and len(sys.argv) >= 4:
            sources = sys.argv[3].split(",")
            result = client.fold(sys.argv[2], sources)
            print(result)
        elif cmd == "info" and len(sys.argv) >= 3:
            result = client.info(sys.argv[2])
            print(json.dumps(result))
        elif cmd == "subscribe" and len(sys.argv) >= 3:
            for event_type, value in client.subscribe(sys.argv[2]):
                print(f"{event_type}: {value}")
        else:
            print(__doc__)
            sys.exit(1)
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
