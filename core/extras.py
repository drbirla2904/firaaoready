import hashlib, secrets
from datetime import timedelta
from django.conf import settings
from django.db import transaction
from django.db.models import Sum
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.authtoken.models import Token
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from .throttles import AuthThrottle
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from . import services
from decimal import Decimal, InvalidOperation
from django.db.models import Q
from .models import (AuditLog, Business, CustomerProfile, OtpCode, Payment, Program, PurchaseEntry, Reward, RewardGrant,
                     Subscription, Task, TaskProgress, User, Vendor)
from .notify import notify, push
from .serializers import BusinessSerializer, CustomerProfileImageSerializer, EntrySerializer


@api_view(["PATCH"])
def business_settings(request, code):
    biz = get_object_or_404(Business, shop_code=code, owner=request.user)
    upi = request.data.get("pay_upi_id")
    if upi and Business.objects.filter(pay_upi_id=upi).exclude(pk=biz.pk).exists():
        raise ValidationError("This UPI ID is already registered.")
    s = BusinessSerializer(biz, data=request.data, partial=True)
    s.is_valid(raise_exception=True)
    s.save()
    return Response(s.data)


@api_view(["PATCH", "DELETE"])
@transaction.atomic
def program_update(request, pk):  # pause / resume / end / rename
    pr = get_object_or_404(Program.objects.select_for_update(), pk=pk, business__owner=request.user)
    archived = AuditLog.objects.filter(
        business=pr.business, action="program_archived", ref=str(pr.pk)
    ).exists()
    if request.method == "DELETE":
        if archived:
            return Response({"archived": True, "detail": "This program is already archived."})
        task_ids = pr.tasks.values_list("id", flat=True)
        has_customer_data = (
            PurchaseEntry.objects.filter(task_id__in=task_ids).exists()
            or TaskProgress.objects.filter(task_id__in=task_ids).exists()
            or RewardGrant.objects.filter(reward__task_id__in=task_ids).exists()
        )
        if has_customer_data:
            pr.active = False
            pr.end = timezone.localdate() - timedelta(days=1)
            pr.save(update_fields=["active", "end"])
            AuditLog.objects.create(
                business=pr.business, actor=request.user, action="program_archived", ref=str(pr.pk)
            )
            return Response({
                "archived": True,
                "detail": "This program has customer history, so it was archived. Existing progress and reward codes are preserved.",
            })
        pr.delete()
        return Response({"archived": False, "detail": "Program deleted."})
    if archived and request.data.get("active") is True:
        raise ValidationError("Archived programs cannot be resumed. Create a new program instead.")
    for k in ("title", "active", "start", "end"):
        if k in request.data:
            setattr(pr, k, request.data[k])
    pr.save()
    return Response({"active": pr.active})


REWARD_TYPES = ("free_item", "percent_off", "flat_off", "gift", "custom")
TASK_TYPES = ("count", "amount", "visit")


def _num(v, label, lo, hi):
    try:
        d = Decimal(str(v))
    except (InvalidOperation, ValueError):
        raise ValidationError(f"{label} must be a number.")
    if not d.is_finite() or d < lo or d > hi:
        raise ValidationError(f"{label} must be between {lo} and {hi}.")
    return d


def _text(v, label, maxlen, required=True):
    v = str(v if v is not None else "").strip()
    if required and not v:
        raise ValidationError(f"{label} is required.")
    if len(v) > maxlen:
        raise ValidationError(f"{label} is too long (max {maxlen}).")
    return v


def _clean_reward(d, partial=False):
    out = {}
    if not partial or "title" in d:
        out["title"] = _text(d.get("title"), "Reward name", 120)
    if not partial or "type" in d:
        if d.get("type") not in REWARD_TYPES:
            raise ValidationError("Choose a valid reward type.")
        out["type"] = d["type"]
    if not partial or "value" in d:
        out["value"] = _num(d.get("value", 0), "Value", 0, 1_000_000)
    if not partial or "expiry_days" in d:
        out["expiry_days"] = int(_num(d.get("expiry_days", 30), "Valid days", 1, 365))
    if "terms" in d:
        out["terms"] = _text(d.get("terms"), "Terms", 500, required=False)
    if out.get("type") == "percent_off" and out.get("value", 0) > 100:
        raise ValidationError("A percentage cannot be more than 100.")
    return out


@api_view(["PATCH"])
@transaction.atomic
def reward_update(request, pk):
    """Edit a reward. Codes already issued keep working; the new wording and value apply to every reward from now on."""
    r = get_object_or_404(Reward.objects.select_for_update(), Q(task__program__business__owner=request.user) | Q(business__owner=request.user), pk=pk)
    for k, v in _clean_reward(request.data, partial=True).items():
        setattr(r, k, v)
    r.save()
    biz = r.task.program.business if r.task_id else r.business
    AuditLog.objects.create(business=biz, actor=request.user, action="reward_edit", ref=str(r.pk))
    return Response({"id": r.pk, "title": r.title, "type": r.type, "value": str(r.value), "expiry_days": r.expiry_days, "terms": r.terms})


@api_view(["POST"])
@transaction.atomic
def program_add_task(request, pk):
    """Add another stamp card (and its reward) to a running program without touching anyone's progress."""
    from .serializers import ProgramSerializer
    pr = get_object_or_404(Program.objects.select_for_update(), pk=pk, business__owner=request.user)
    if AuditLog.objects.filter(business=pr.business, action="program_archived", ref=str(pr.pk)).exists():
        raise ValidationError("This program is archived. Create a new program instead.")
    d = request.data
    if d.get("type") not in TASK_TYPES:
        raise ValidationError("Choose how customers earn: count, amount or visit.")
    t = Task.objects.create(program=pr, title=_text(d.get("title"), "Name", 120), type=d["type"],
        target=_num(d.get("target"), "Target", 1, 1_000_000), item_name=_text(d.get("item_name"), "Item", 80, required=False),
        repeatable=bool(d.get("repeatable", True)), max_per_customer=int(_num(d.get("max_per_customer", 0), "Limit", 0, 1000)))
    if d.get("reward"):
        Reward.objects.create(task=t, **_clean_reward(d["reward"]))
    return Response(ProgramSerializer(pr).data, status=201)


QUICK_TEMPLATES = {"stamps": "count", "spend": "amount", "visits": "visit"}


@api_view(["POST"])
@transaction.atomic
def quick_reward(request, code):
    """The easy way to add a reward: pick how customers earn, two numbers, what they get. Creates the stamp card and the reward
    together inside the shop's running program (or starts one), and writes a clear title so the owner never has to."""
    from .serializers import ProgramSerializer
    biz = get_object_or_404(Business.objects.select_for_update(), shop_code=code, owner=request.user)
    d = request.data
    tpl = d.get("template")
    if tpl not in QUICK_TEMPLATES:
        raise ValidationError("Choose how customers earn: buy and get, spend and save, or visit and get.")
    n = _num(d.get("n"), "The number", 1, 1_000_000 if tpl == "spend" else 100)
    if tpl != "spend" and n != n.to_integral_value():
        raise ValidationError("Use a whole number.")
    n = int(n) if n == n.to_integral_value() else n
    item = _text(d.get("item"), "Item", 80, required=False) if tpl == "stamps" else ""
    gtype = d.get("give_type", "free_item")
    if gtype not in ("free_item", "percent_off", "flat_off"):
        raise ValidationError("Choose what customers get: a free item, a percentage off, or money off.")
    value = _num(d.get("give_value", 0), "The discount", 1 if gtype != "free_item" else 0, 100 if gtype == "percent_off" else 1_000_000)
    give = _text(d.get("give"), "What customers get", 120)
    reward = _clean_reward({"title": give, "type": gtype, "value": value, "expiry_days": d.get("expiry_days", 30), "terms": d.get("terms", "")})
    title = {"stamps": f"Buy {n} {item}".strip() if item else f"Buy {n} times", "spend": f"Spend ₹{n:,}", "visits": f"Visit {n} times"}[tpl]
    archived = set(AuditLog.objects.filter(business=biz, action="program_archived").values_list("ref", flat=True))
    pr = next((p for p in biz.programs.order_by("-active", "id") if str(p.pk) not in archived), None) or Program.objects.create(business=biz, title="Rewards")
    if Reward.objects.filter(task__program=pr, task__title=title, title=give).exists():
        raise ValidationError("You already have this exact reward.")
    t = Task.objects.create(program=pr, title=title, type=QUICK_TEMPLATES[tpl], target=n, item_name=item, repeatable=bool(d.get("repeatable", True)))
    Reward.objects.create(task=t, **reward)
    AuditLog.objects.create(business=biz, actor=request.user, action="reward_quick_add", ref=str(t.pk))
    return Response(ProgramSerializer(pr).data, status=201)


@api_view(["PATCH"])
def task_update(request, pk):
    """Edits never hurt in-progress customers: their TaskProgress keeps the target it started with."""
    t = get_object_or_404(Task, pk=pk, program__business__owner=request.user)
    clean = {}
    if "title" in request.data:
        clean["title"] = _text(request.data["title"], "Name", 120)
    if "target" in request.data:
        clean["target"] = _num(request.data["target"], "Target", 1, 1_000_000)
    for k in ("title", "target", "item_name", "repeatable", "max_per_customer"):
        if k in request.data:
            setattr(t, k, clean.get(k, request.data[k]))
    t.version += 1
    t.save()
    return Response({"version": t.version})


@api_view(["POST"])
def reverse(request, pk):
    e = services.reverse_entry(get_object_or_404(PurchaseEntry, pk=pk), request.user)
    return Response(EntrySerializer(e).data)


@api_view(["GET"])
def recent(request):
    from django.db.models import Q
    qs = PurchaseEntry.objects.filter(status="approved").filter(
        Q(profile__business__owner=request.user) | Q(profile__business__staff__user=request.user)).order_by("-id")[:8]
    return Response(EntrySerializer(qs, many=True).data)


@api_view(["POST"])
def block(request, code, pid):
    biz = get_object_or_404(Business, shop_code=code, owner=request.user)
    p = get_object_or_404(CustomerProfile, pk=pid, business=biz)
    p.status = "blocked" if request.data.get("blocked", True) else "active"
    p.save()
    return Response({"status": p.status})


@api_view(["POST"])
def broadcast(request, code):
    """Offer to customers who opted in (marketing consent). Max one per 24h per shop."""
    biz = get_object_or_404(Business, shop_code=code, owner=request.user)
    text = str(request.data.get("text", "")).strip()[:200]
    if not text:
        raise ValidationError("Write the offer text.")
    if AuditLog.objects.filter(business=biz, action="broadcast", at__gte=timezone.now() - timedelta(hours=24)).exists():
        raise ValidationError("You can send one offer per day.")
    users = [p.user for p in biz.customers.filter(marketing_consent=True, status="active").select_related("user")]
    for u in users:
        push(u, f"{biz.name}: {text}", link=f"/b/{biz.shop_code}/?tab=earn")
    AuditLog.objects.create(business=biz, actor=request.user, action="broadcast", ref=str(len(users)))
    return Response({"sent": len(users)})


@api_view(["DELETE"])
def delete_me(request):
    """DPDP erasure. Customers are deleted; owners/vendors are anonymised (invoices/commissions must be retained)."""
    u = request.user
    if u.role == "customer":
        u.delete()
    else:
        Token.objects.filter(user=u).delete()
        u.is_active, u.username, u.first_name = False, f"deleted-{u.id}", ""
        u.set_unusable_password()
        u.save()
        u.businesses.update(status="closed")
        if hasattr(u, "vendor"):
            u.vendor.status = "suspended"
            u.vendor.save(update_fields=["status"])
    return Response(status=204)


@api_view(["GET", "PATCH", "DELETE"])
def profile_image(request):
    if request.user.role != "customer":
        raise PermissionDenied("Customer account required.")
    user = request.user
    if request.method == "GET":
        return Response({"profile_image_url": user.profile_image.url if user.profile_image else ""})
    if request.method == "DELETE":
        if user.profile_image:
            user.profile_image.delete(save=False)
            user.profile_image = ""
            user.save(update_fields=["profile_image"])
        return Response({"profile_image_url": ""})
    serializer = CustomerProfileImageSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    previous_name = user.profile_image.name
    user.profile_image = serializer.validated_data["profile_image"]
    user.save(update_fields=["profile_image"])
    if previous_name and previous_name != user.profile_image.name:
        user.profile_image.storage.delete(previous_name)
    return Response({"profile_image_url": user.profile_image.url})


def _h(code):
    return hashlib.sha256((code + settings.SECRET_KEY).encode()).hexdigest()


@api_view(["POST"])
@permission_classes([AllowAny])
@throttle_classes([AuthThrottle])
def otp_request(request):
    u = User.objects.filter(username=str(request.data.get("mobile", "")).strip(), is_active=True).first()
    if u and not OtpCode.objects.filter(user=u, created_at__gte=timezone.now() - timedelta(seconds=60)).exists():
        code = f"{secrets.randbelow(10**6):06d}"
        OtpCode.objects.create(user=u, code_hash=_h(code), expires=timezone.now() + timedelta(minutes=10))
        notify(u, f"Firaao OTP {code}. Valid for 10 minutes. Do not share it.")
    return Response({"detail": "If the number is registered, an OTP was sent."})  # same answer either way


@api_view(["POST"])
@permission_classes([AllowAny])
@throttle_classes([AuthThrottle])
def otp_confirm(request):
    u = User.objects.filter(username=str(request.data.get("mobile", "")).strip(), is_active=True).first()
    o = OtpCode.objects.filter(user=u, expires__gt=timezone.now()).order_by("-id").first() if u else None
    new = request.data.get("new", "")
    if not o or o.attempts >= 5 or len(new) < 6:
        raise ValidationError("Wrong or expired OTP.")
    if o.code_hash != _h(str(request.data.get("otp", "")).strip()):
        o.attempts += 1; o.save()
        raise ValidationError("Wrong or expired OTP.")
    u.set_password(new); u.save()
    OtpCode.objects.filter(user=u).delete()
    Token.objects.filter(user=u).delete()  # sign out other devices
    return Response({"detail": "Password changed."})


@api_view(["POST"])
def accept_terms(request):
    request.user.consent_at = timezone.now()
    request.user.save(update_fields=["consent_at"])
    return Response(status=204)


@api_view(["GET"])
def admin_stats(request):
    if not request.user.is_staff:
        raise PermissionDenied()
    states = {}
    for s in Subscription.objects.all():
        states[s.state] = states.get(s.state, 0) + 1
    rev = Payment.objects.filter(status="paid", created_at__gte=timezone.now() - timedelta(days=30)).aggregate(t=Sum("amount"))["t"] or 0
    return Response({"shops": Business.objects.count(), "subscriptions": states, "revenue_30d_rupees": rev / 100,
        "customers": User.objects.filter(role="customer").count(),
        "entries_today": PurchaseEntry.objects.filter(created_at__date=timezone.localdate()).count(),
        "vendors_pending": Vendor.objects.filter(status="pending").count()})
