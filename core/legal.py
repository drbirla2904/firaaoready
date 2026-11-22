from django.conf import settings
from django.shortcuts import render

PAGES = {"about", "privacy", "terms", "refund", "pricing", "contact", "shipping-delivery"}


def page(request, page):
    P = settings.PLANS
    ctx = {"c": settings.COMPANY, "trial": settings.TRIAL_DAYS, "grace": settings.GRACE_DAYS,
           "retention": settings.RETENTION_MONTHS, "gst": settings.GST_RATE,
           "monthly": P["monthly"]["amount"] // 100, "yearly": P["yearly"]["amount"] // 100}
    return render(request, f"legal/{page}.html", ctx)
