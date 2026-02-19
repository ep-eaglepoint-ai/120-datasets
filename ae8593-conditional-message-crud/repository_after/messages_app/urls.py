from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'messages', views.MessageViewSet)

urlpatterns = [
    path('api/', include(router.urls)),
    path('', views.dashboard, name='dashboard'),
    path('create/', views.MessageCreateView.as_view(), name='message_create'),
    path('<int:pk>/update/', views.MessageUpdateView.as_view(), name='message_update'),
    path('<int:pk>/delete/', views.MessageDeleteView.as_view(), name='message_delete'),
]