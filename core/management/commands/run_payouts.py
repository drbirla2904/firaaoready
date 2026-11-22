from django.core.management.base import BaseCommand
from django.db import transaction
from django.db.models import Sum
from django.conf import settings
from django.utils import timezone
from core.models import Commission, Payout, Vendor


class Command(BaseCommand):
    help = "Monthly: bundle commissions past the hold period into pending payouts (min threshold)."

    def add_arguments(self, p):
        p.add_argument("--force", action="store_true")

    def handle(self, *a, **o):
        if timezone.localdate().day != 1 and not o["force"]:
            return
        n = 0
        for v in Vendor.objects.filter(status="approved"):
            with transaction.atomic():
                qs = Commission.objects.select_for_update().filter(vendor=v, status="hold", payable_on__lte=timezone.now())
                total = qs.aggregate(t=Sum("amount"))["t"] or 0
                if total >= settings.MIN_PAYOUT_PAISE:
                    po = Payout.objects.create(vendor=v, amount=total)
                    qs.update(status="payable", payout=po)
                    n += 1
        self.stdout.write(f"{n} payouts created")
