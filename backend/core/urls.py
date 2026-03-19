from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    RegisterView, LoginView, LogoutView, ProfileView,
    UserViewSet, KYCApplicationViewSet, SystemAlertViewSet,
    DashboardStatsView, VerificationLogViewSet
)

router = DefaultRouter()
router.register(r"users", UserViewSet, basename="users")
router.register(r"kyc-applications", KYCApplicationViewSet, basename="kyc-applications")
router.register(r"alerts", SystemAlertViewSet, basename="alerts")
router.register(r"logs", VerificationLogViewSet, basename="logs")

urlpatterns = [
    # Auth
    path("auth/register/", RegisterView.as_view(), name="register"),
    path("auth/login/", LoginView.as_view(), name="login"),
    path("auth/logout/", LogoutView.as_view(), name="logout"),
    path("auth/profile/", ProfileView.as_view(), name="profile"),

    # Dashboard
    path("dashboard/stats/", DashboardStatsView.as_view(), name="dashboard-stats"),

    # Router URLs
    path("", include(router.urls)),
]