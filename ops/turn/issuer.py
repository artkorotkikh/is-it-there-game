"""Loopback-only TURN REST issuer; Caddy overwrites the client IP header.

Browser origin filtering is not authentication. Bounded issuance and coturn
allocation/bandwidth quotas limit this public service's exposure.
"""
import base64
import hashlib
import hmac
import json
import os
import secrets
import time
from http.server import BaseHTTPRequestHandler, HTTPServer

ORIGINS = {
    'https://isitthereyet.nano-tema--0v1.opencloud.org',
    'https://z4wnx-uqaaa-aaabz-aadeq-cai.icp.net',
}
SECRET = os.environ['TURN_SECRET'].encode()
HOST = 'turn.62-84-183-92.sslip.io'
TTL = 3600
buckets = {}

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        origin = self.headers.get('Origin', '')
        if self.path != '/connection-config':
            self.send_error(404)
            return
        if origin not in ORIGINS:
            self.send_error(403)
            return
        now = int(time.time())
        ip = self.headers.get('X-Turn-Client-IP', '')
        # At most 20 requests/minute/IP, 500 globally; bounded memory.
        for key in list(buckets):
            if buckets[key][0] != now // 60:
                del buckets[key]
        for key, limit in [('global', 500), ('ip:' + ip, 20)]:
            window, count = buckets.get(key, (now // 60, 0))
            if count >= limit:
                self.send_error(429)
                return
        for key in ['global', 'ip:' + ip]:
            buckets[key] = (now // 60, buckets.get(key, (0, 0))[1] + 1)
        username = f'{now + TTL}:{secrets.token_hex(12)}'
        credential = base64.b64encode(hmac.new(SECRET, username.encode(), hashlib.sha1).digest()).decode()
        body = json.dumps({'iceServers': [
            {'urls': ['stun:' + HOST + ':3478']},
            {'urls': ['turn:' + HOST + ':3478?transport=udp', 'turn:' + HOST + ':3478?transport=tcp'],
             'username': username, 'credential': credential},
        ], 'ttl': TTL}).encode()
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Access-Control-Allow-Origin', origin)
        self.send_header('Vary', 'Origin')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *_args):
        pass  # Credentials and caller addresses must not enter application logs.

if __name__ == '__main__':
    HTTPServer(('127.0.0.1', 9187), Handler).serve_forever()
