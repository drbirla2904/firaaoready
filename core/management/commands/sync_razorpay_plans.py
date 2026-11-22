"""Create (or refresh) the Razorpay plans AutoPay needs, using only the API keys. Safe to run any time."""
from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from core import billing


class Command(BaseCommand):
    help = "Create the monthly and yearly Razorpay plans used for AutoPay (skips any set in the environment)."

    def handle(self, *args, **opts):
        if not (settings.RAZORPAY_KEY_ID and settings.RAZORPAY_KEY_SECRET):
            raise CommandError("Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET first.")
        for plan in settings.PLANS:
            try:
                self.stdout.write(f"{plan}: {billing.plan_id(plan)}")
            except Exception as exc:  # friendly: show what Razorpay said
                raise CommandError(f"{plan}: {exc}")
