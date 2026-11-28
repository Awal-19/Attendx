import time
from collections import deque
from threading import Lock
from django.utils import timezone

_METRICS_LOCK = Lock()
_TOTAL_REQUESTS = 0
_ERROR_REQUESTS = 0
_LATENCIES_MS = deque(maxlen=250)
_RECENT_ERRORS = deque(maxlen=25)


class SecurityHeadersMiddleware:
    """Adds CSP, Referrer-Policy, and Permissions-Policy headers to all HTTP responses."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        response.setdefault(
            "Content-Security-Policy",
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline'; "
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
            "font-src 'self' https://fonts.gstatic.com data:; "
            "img-src 'self' data: blob: https:; "
            "connect-src 'self' ws: wss: https:; "
            "frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
        )
        response.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
        response.setdefault(
            "Permissions-Policy",
            "camera=(self), microphone=(), geolocation=()",
        )
        return response


class SystemMonitoringMiddleware:
    """Tracks live API response times, request counts, and HTTP 5xx/4xx errors."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        start = time.perf_counter()
        response = None
        try:
            response = self.get_response(request)
            return response
        except Exception as exc:
            with _METRICS_LOCK:
                _RECENT_ERRORS.appendleft(
                    {
                        "timestamp": timezone.now().isoformat(),
                        "path": request.path,
                        "method": request.method,
                        "status": 500,
                        "error": str(exc)[:240],
                    }
                )
            raise
        finally:
            elapsed_ms = (time.perf_counter() - start) * 1000.0
            status_code = response.status_code if response is not None else 500
            if request.path.startswith("/api/"):
                with _METRICS_LOCK:
                    global _TOTAL_REQUESTS, _ERROR_REQUESTS
                    _TOTAL_REQUESTS += 1
                    _LATENCIES_MS.append(round(elapsed_ms, 2))
                    if status_code >= 500:
                        _ERROR_REQUESTS += 1
                        _RECENT_ERRORS.appendleft(
                            {
                                "timestamp": timezone.now().isoformat(),
                                "path": request.path,
                                "method": request.method,
                                "status": status_code,
                                "error": f"HTTP {status_code}",
                            }
                        )


def get_runtime_metrics():
    with _METRICS_LOCK:
        lats = list(_LATENCIES_MS)
        avg_ms = round(sum(lats) / len(lats), 2) if lats else 0.0
        max_ms = round(max(lats), 2) if lats else 0.0
        err_rate = round((_ERROR_REQUESTS / _TOTAL_REQUESTS) * 100.0, 2) if _TOTAL_REQUESTS else 0.0
        return {
            "total_api_requests": _TOTAL_REQUESTS,
            "server_error_count": _ERROR_REQUESTS,
            "error_rate_percent": err_rate,
            "avg_response_ms": avg_ms,
            "max_response_ms": max_ms,
            "recent_errors": list(_RECENT_ERRORS),
        }

