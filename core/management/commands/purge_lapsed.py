from datetime import timedelta
from django.conf import settings
from django.core.management.base import BaseCommand
from django.utils import timezone
from core.models import PurchaseEntry, Subscription


class Command(BaseCommand):
    help = "Delete shop data (customers, entries, bill photos) for shops lapsed longer than grace + RETENTION_MONTHS. Dry run unless --apply."

    def add_arguments(self, p):
        p.add_argument("--apply", action="store_true")

    def handle(self, *a, **o):
        now, n = timezone.now(), 0
        limit = timedelta(days=settings.GRACE_DAYS + 30 * settings.RETENTION_MONTHS)
        for s in Subscription.objects.select_related("owner"):
            if now <= (s.paid_until or s.trial_ends) + limit:
                continue
            for b in s.owner.businesses.all():
                self.stdout.write(("DELETE " if o["apply"] else "would delete ") + f"{b.name} ({b.shop_code}) owner {s.owner.username}")
                if o["apply"]:
                    for e in PurchaseEntry.objects.filter(profile__business=b).exclude(bill_photo=""):
                        e.bill_photo.delete(save=False)
                    b.delete()
                n += 1
        self.stdout.write(f"{n} shop(s)")
