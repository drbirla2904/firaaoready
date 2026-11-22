import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    """v2 growth layer: branding, tiers, welcome/referral perks, boosts, services, bookings, feedback."""

    dependencies = [
        ("core", "0006_vendor_applied_at"),
    ]

    operations = [
        # ---- Business: branding, tiers, bookings ----
        migrations.AddField("business", "brand_color", models.CharField(blank=True, default="#126b5c", max_length=7)),
        migrations.AddField("business", "logo", models.ImageField(blank=True, upload_to="logos/")),
        migrations.AddField("business", "about", models.TextField(blank=True, max_length=600)),
        migrations.AddField("business", "phone", models.CharField(blank=True, max_length=20)),
        migrations.AddField("business", "whatsapp", models.CharField(blank=True, max_length=20)),
        migrations.AddField("business", "maps_url", models.URLField(blank=True)),
        migrations.AddField("business", "tier_silver_visits", models.PositiveIntegerField(default=5)),
        migrations.AddField("business", "tier_gold_visits", models.PositiveIntegerField(default=15)),
        migrations.AddField("business", "silver_perk", models.CharField(blank=True, max_length=120)),
        migrations.AddField("business", "gold_perk", models.CharField(blank=True, max_length=120)),
        migrations.AddField("business", "bookings_enabled", models.BooleanField(default=False)),
        # ---- Reward: business-level perks ----
        migrations.AlterField(
            "reward", "task",
            models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE,
                              related_name="rewards", to="core.task"),
        ),
        migrations.AddField("reward", "trigger", models.CharField(
            choices=[("task", "task"), ("welcome", "welcome"), ("referral", "referral"), ("retired", "retired")], default="task", max_length=10)),
        migrations.AddField("reward", "business", models.ForeignKey(
            blank=True, null=True, on_delete=django.db.models.deletion.CASCADE,
            related_name="perk_rewards", to="core.business")),
        # ---- CustomerProfile: referral + owner note ----
        migrations.AddField("customerprofile", "referral_code", models.CharField(blank=True, db_index=True, max_length=8)),
        migrations.AddField("customerprofile", "referred_by", models.ForeignKey(
            blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL,
            related_name="referred", to="core.customerprofile")),
        migrations.AddField("customerprofile", "note", models.CharField(blank=True, max_length=300)),
        # ---- PurchaseEntry: boost bookkeeping ----
        migrations.AddField("purchaseentry", "credited_value", models.DecimalField(
            blank=True, decimal_places=2, max_digits=12, null=True)),
        migrations.AddField("purchaseentry", "multiplier", models.PositiveSmallIntegerField(default=1)),
        # ---- New models ----
        migrations.CreateModel(
            name="Boost",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("title", models.CharField(max_length=80)),
                ("multiplier", models.PositiveSmallIntegerField(default=2)),
                ("weekdays", models.CharField(blank=True, max_length=13)),
                ("start_time", models.TimeField(blank=True, null=True)),
                ("end_time", models.TimeField(blank=True, null=True)),
                ("start", models.DateField(blank=True, null=True)),
                ("end", models.DateField(blank=True, null=True)),
                ("active", models.BooleanField(default=True)),
                ("business", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE,
                                               related_name="boosts", to="core.business")),
            ],
        ),
        migrations.CreateModel(
            name="Service",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=80)),
                ("price", models.DecimalField(decimal_places=2, default=0, max_digits=10)),
                ("duration_min", models.PositiveIntegerField(default=30)),
                ("description", models.CharField(blank=True, max_length=200)),
                ("active", models.BooleanField(default=True)),
                ("business", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE,
                                               related_name="services", to="core.business")),
            ],
        ),
        migrations.CreateModel(
            name="Booking",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("starts_at", models.DateTimeField()),
                ("status", models.CharField(
                    choices=[("requested", "requested"), ("confirmed", "confirmed"), ("completed", "completed"),
                             ("cancelled", "cancelled"), ("declined", "declined"), ("no_show", "no_show")],
                    default="requested", max_length=10)),
                ("note", models.CharField(blank=True, max_length=200)),
                ("credited", models.BooleanField(default=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("profile", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE,
                                              related_name="bookings", to="core.customerprofile")),
                ("service", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE,
                                              related_name="bookings", to="core.service")),
            ],
        ),
        migrations.CreateModel(
            name="Feedback",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("rating", models.PositiveSmallIntegerField()),
                ("comment", models.CharField(blank=True, max_length=300)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("booking", models.OneToOneField(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL,
                                                 related_name="feedback", to="core.booking")),
                ("entry", models.OneToOneField(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL,
                                               related_name="feedback", to="core.purchaseentry")),
                ("profile", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE,
                                              related_name="feedback", to="core.customerprofile")),
            ],
        ),
    ]
