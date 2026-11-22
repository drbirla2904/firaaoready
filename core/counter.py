"""Rotating one-time counter code (TOTP-style, 60s steps). Staff shows it; customer submits it after paying."""
import hashlib, hmac, time
from django.conf import settings
STEP = 60


def code_for(biz, step):
    key = f"{settings.SECRET_KEY}:{biz.id}:{biz.shop_code}".encode()  # regenerating the QR also rotates the key
    d = hmac.new(key, str(step).encode(), hashlib.sha256).digest()
    return f"{int.from_bytes(d[:4], 'big') % 10**6:06d}"


def current(biz):
    now = int(time.time())
    return code_for(biz, now // STEP), STEP - now % STEP


def match(biz, code):
    """Returns the matching step (current or previous) or None."""
    s = int(time.time()) // STEP
    for st in (s, s - 1):
        if hmac.compare_digest(code_for(biz, st), str(code).strip()):
            return st
    return None
