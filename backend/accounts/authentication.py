from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken


ROLE_COOKIE_ACCESS_NAMES = (
    "attendx_access_admin",
    "attendx_access_lecturer",
    "attendx_access_student",
    "attendx_access",
)


class CookieOrHeaderJWTAuthentication(JWTAuthentication):
    """Authenticate via Authorization Bearer header or role-scoped httpOnly access cookie."""

    def authenticate(self, request):
        header = self.get_header(request)
        if header is not None:
            raw_token = self.get_raw_token(header)
        else:
            raw_token = None
            for cookie_name in ROLE_COOKIE_ACCESS_NAMES:
                val = request.COOKIES.get(cookie_name)
                if val:
                    raw_token = val.encode("utf-8") if isinstance(val, str) else val
                    break

        if raw_token is None:
            return None

        validated_token = self.get_validated_token(raw_token)
        user = self.get_user(validated_token)
        if not user.is_active or getattr(user, "is_suspended", False):
            raise InvalidToken("User account is inactive or suspended.")
        return user, validated_token

