from django.db import migrations, models


class Migration(migrations.Migration):
    """Partner payouts record when they were paid and how much TDS was withheld."""

    dependencies = [
        ("core", "0007_growth_layer"),
    ]

    operations = [
        migrations.AddField("payout", "paid_at", models.DateTimeField(blank=True, null=True)),
        migrations.AddField("payout", "tds", models.PositiveIntegerField(default=0)),
    ]
