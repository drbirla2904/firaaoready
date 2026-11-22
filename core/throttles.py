from rest_framework.throttling import AnonRateThrottle


class AuthThrottle(AnonRateThrottle):
    scope = "auth"  # login / register / OTP: 10 per minute per IP
