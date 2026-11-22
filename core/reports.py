import csv
from datetime import timedelta
from django.core import signing
from django.db.models import Count, Max, Q
from django.db.models.functions import ExtractHour
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.decorators import api_view
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response
from .models import (Business, CustomerProfile, Notification, PurchaseEntry, Reward, RewardGrant,
                     TaskProgress)


def _customers(biz):
    ok = Q(entries__status="approved")
    return CustomerProfile.objects.filter(business=biz).select_related("user").annotate(
        visits=Count("entries", filter=ok), last=Max("entries__created_at", filter=ok))


@api_view(["GET"])
def report(request, code):
    biz = get_object_or_404(Business, shop_code=code)
    if biz.owner_id != request.user.id:
        raise PermissionDenied()
    cs = list(_customers(biz))
    buyers = [c for c in cs if c.visits >= 1]
    entries = PurchaseEntry.objects.filter(profile__business=biz, status="approved")
    hours = entries.annotate(h=ExtractHour("created_at")).values("h").annotate(n=Count("id")).order_by("-n")[:3]
    grants = RewardGrant.objects.filter(profile__business=biz)
    today = timezone.localdate()
    return Response({
        "customers": len(cs),
        "repeat_rate": round(100 * sum(c.visits >= 2 for c in buyers) / len(buyers)) if buyers else 0,
        "top": [{"name": c.user.first_name or c.user.username[-4:], "visits": c.visits}
                for c in sorted(buyers, key=lambda c: -c.visits)[:5]],
        "rewards_issued": grants.count(), "rewards_redeemed": grants.filter(status="used").count(),
        "peak_hours": [{"hour": h["h"], "count": h["n"]} for h in hours],
        "approved_today": entries.filter(created_at__date=today).count(),
        "csv_url": "/export/" + signing.dumps(biz.id, salt="csv") + "/",  # short-lived signed link
    })


@api_view(["GET"])
def reward_activity(request, code):
    biz = get_object_or_404(Business, shop_code=code)
    if biz.owner_id != request.user.id:
        raise PermissionDenied()

    rewards = list(Reward.objects.filter(task__program__business=biz).select_related(
        "task", "task__program"
    ).order_by("task__program__title", "task__title", "title"))
    if not rewards:
        return Response({"rewards": []})

    task_ids = {reward.task_id for reward in rewards}
    reward_ids = {reward.id for reward in rewards}
    progress_by_task = {}
    for progress in TaskProgress.objects.filter(task_id__in=task_ids).select_related(
        "profile__user"
    ):
        progress_by_task.setdefault(progress.task_id, {})[progress.profile_id] = progress

    grants_by_reward = {}
    for grant in RewardGrant.objects.filter(reward_id__in=reward_ids).select_related(
        "profile__user"
    ).order_by("-issued_at"):
        grants_by_reward.setdefault(grant.reward_id, {}).setdefault(
            grant.profile_id, []
        ).append(grant)

    last_activity = {
        (row["task_id"], row["profile_id"]): row["last_activity"]
        for row in PurchaseEntry.objects.filter(
            task_id__in=task_ids, status="approved"
        ).values("task_id", "profile_id").annotate(last_activity=Max("reviewed_at"))
    }

    now = timezone.now()
    result = []
    for reward in rewards:
        progress_for_task = progress_by_task.get(reward.task_id, {})
        grants_for_reward = grants_by_reward.get(reward.id, {})
        profile_ids = set(progress_for_task) | set(grants_for_reward)
        customers = []
        ready_count = redeemed_count = issued_count = in_progress_count = 0
        for profile_id in profile_ids:
            progress = progress_for_task.get(profile_id)
            grants = grants_for_reward.get(profile_id, [])
            available = sum(grant.status == "active" and grant.expires_at > now for grant in grants)
            redeemed = sum(grant.status == "used" for grant in grants)
            issued = len(grants)
            current = progress.current_value if progress else 0
            completed = progress.completed_count if progress else 0
            profile = (progress.profile if progress else grants[0].profile)
            user = profile.user
            activity_at = last_activity.get((reward.task_id, profile_id))
            if not activity_at and grants:
                activity_at = grants[0].issued_at
            customers.append({
                "profile_id": profile.pk,
                "can_nudge": profile.marketing_consent and profile.status == "active",
                "name": user.first_name or "Customer",
                "mobile": user.username,
                "current": str(current),
                "target": str((progress.target or reward.task.target) if progress else reward.task.target),
                "completed": completed,
                "issued": issued,
                "available": available,
                "redeemed": redeemed,
                "last_activity": activity_at.isoformat() if activity_at else None,
            })
            ready_count += available
            redeemed_count += redeemed
            issued_count += issued
            in_progress_count += current > 0

        customers.sort(key=lambda customer: customer["last_activity"] or "", reverse=True)
        result.append({
            "id": reward.id,
            "title": reward.title,
            "type": reward.type,
            "value": str(reward.value),
            "program": reward.task.program.title,
            "task": reward.task.title,
            "task_type": reward.task.type,
            "target": str(reward.task.target),
            "expiry_days": reward.expiry_days,
            "customers": customers,
            "stats": {
                "participants": len(customers),
                "in_progress": in_progress_count,
                "available": ready_count,
                "issued": issued_count,
                "redeemed": redeemed_count,
            },
        })
    return Response({"rewards": result})


def export_csv(request, token):
    try:
        biz = get_object_or_404(Business, pk=signing.loads(token, salt="csv", max_age=600))
    except signing.BadSignature:
        return HttpResponse("Link expired. Reload the dashboard.", status=403)
    safe = lambda v: ("'" + str(v)) if str(v)[:1] in "=+-@" else str(v)  # CSV formula-injection guard
    r = HttpResponse(content_type="text/csv")
    r["Content-Disposition"] = f'attachment; filename="{biz.shop_code}-customers.csv"'
    w = csv.writer(r)
    w.writerow(["name", "mobile", "visits", "last_visit", "joined"])
    for c in _customers(biz).order_by("-visits"):
        w.writerow([safe(c.user.first_name), safe(c.user.username), c.visits,
                    c.last.date() if c.last else "", c.joined_at.date()])
    return r


@api_view(["GET"])
def notifications(request):
    return Response(list(request.user.notifications.order_by("-id").values("id", "text", "link", "read", "created_at")[:30]))


@api_view(["POST"])
def notifications_read(request):
    if not hasattr(request.data, "get"):
        raise ValidationError("Expected a JSON object.")
    qs = request.user.notifications.filter(read=False)
    if "ids" not in request.data:
        qs.update(read=True)
        return Response(status=204)
    ids = request.data.get("ids")
    if not isinstance(ids, list) or any(not isinstance(pk, int) or isinstance(pk, bool) for pk in ids):
        raise ValidationError("Notification ids must be a list of integers.")
    qs = qs.filter(pk__in=ids)
    return Response({"updated": qs.update(read=True)})
