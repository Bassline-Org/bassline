#!/usr/bin/env python3
"""
Bassline HTTP Client - Python

Zero-dependency client using only standard library.

Usage:
    python client.py [base_url] [token]

Example:
    python client.py http://localhost:8080
    python client.py http://localhost:8080 my-secret-token
"""

import urllib.request
import json
import sys

class Bassline:
    def __init__(self, base_url="http://localhost:8080", token=None):
        self.base = base_url.rstrip('/')
        self.token = token

    def _request(self, path, method="GET", data=None):
        url = f"{self.base}/bl/{path}"
        req = urllib.request.Request(url, method=method)

        if self.token:
            req.add_header("Authorization", f"Bearer {self.token}")

        if data is not None:
            if isinstance(data, (dict, list)):
                body = json.dumps(data).encode()
                req.add_header("Content-Type", "application/json")
            else:
                body = str(data).encode()
            req.data = body

        with urllib.request.urlopen(req) as r:
            text = r.read().decode()
            try:
                return json.loads(text)
            except:
                # Parse primitives
                if text == 'true': return True
                if text == 'false': return False
                if text == 'null': return None
                try: return float(text) if '.' in text else int(text)
                except: return text

    def read(self, ref):
        """Read a cell or fold value"""
        # Strip bl:/// prefix if present
        path = ref.replace('bl:///', '').replace('bl://', '')
        return self._request(path)

    def write(self, ref, value):
        """Write a value to a cell"""
        path = ref.replace('bl:///', '').replace('bl://', '')
        return self._request(path, "PUT", value)


if __name__ == "__main__":
    base = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8080"
    token = sys.argv[2] if len(sys.argv) > 2 else None

    bl = Bassline(base, token)

    print(f"Connected to {base}")
    print()

    # Demo
    print("Writing counter = 42")
    bl.write("cell/counter", 42)

    print(f"Reading counter: {bl.read('cell/counter')}")

    print("Writing user object")
    bl.write("cell/user", {"name": "alice", "active": True})

    user = bl.read("cell/user")
    print(f"Reading user: {user}")

    # Folds
    bl.write("cell/x", 10)
    bl.write("cell/y", 20)
    sources = "bl:///cell/x,bl:///cell/y"
    print(f"Sum(x,y): {bl.read(f'fold/sum?sources={sources}')}")
