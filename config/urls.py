from django.contrib import admin
from django.conf import settings
from django.conf.urls.static import static
from django.urls import include, path
from core import pages, billing, legal, reports
urlpatterns = [
    path("admin/", admin.site.urls), path("api/", include("core.urls")),
    path("export/<str:token>/", reports.export_csv),
    path("invoice/<str:token>/", billing.invoice),
    path("print/<str:code>/", pages.print_card), path("kit/<str:code>/", pages.partner_flyer),
    path("b/<str:code>/", pages.shell), path("app/classic/", pages.classic), path("app/", pages.shell), path("", pages.shell),
    *[path(f"{p}/", legal.page, {"page": p}) for p in sorted(legal.PAGES)],
    path("healthz", pages.healthz), path("manifest.json", pages.manifest), path("sw.js", pages.sw), path("icon.svg", pages.icon),
]
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
