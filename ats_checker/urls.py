from django.contrib import admin
from django.conf import settings
from django.conf.urls.static import static
from django.http import Http404, HttpResponse, HttpResponseRedirect
from django.urls import include, path, re_path
from django.views.static import serve


FRONTEND_BUILD_DIR = settings.BASE_DIR / "frontend-build"


def frontend_app(request, path=""):
    """Serve the built React app for the root and client-side routes."""
    index_file = FRONTEND_BUILD_DIR / "index.html"
    if index_file.is_file():
        return HttpResponse(index_file.read_bytes(), content_type="text/html; charset=utf-8")
    if settings.DEBUG:
        return HttpResponseRedirect("http://localhost:5173")
    raise Http404("Frontend build is missing")


urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('analyzer.urls')),
    path('static/<path:path>', serve, {'document_root': FRONTEND_BUILD_DIR}),
    path('', frontend_app),
    # React Router handles client routes such as /upload and /dashboard.
    re_path(r'^(?!api/|admin/|static/|media/).*$', frontend_app),
]

# Serve media files in development
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
