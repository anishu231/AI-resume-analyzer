# analyzer/urls.py
from django.urls import path
from . import views
from . import chat_views
from . import email_auth_views

urlpatterns = [
    # Upload endpoint
    path('upload/', views.upload_resume, name='upload_resume'),
    
    # List candidates (legacy)
    path('candidates/', views.list_candidates, name='list_candidates'),
    
    # ML analysis endpoint
    path('ml-analyze/', views.ml_analyze, name='ml_analyze'),

    
    # Dashboard endpoints
    path('dashboard/', views.dashboard_data, name='dashboard_data'),           # All candidates
    path('dashboard/latest/', views.dashboard_latest, name='dashboard_latest'), # Latest batch only
    path('dashboard/history/', views.dashboard_history, name='dashboard_history'), # ALL history (paginated)
    path(
    'delete-session/<str:session_id>/',
    views.delete_session,
    name='delete_session'
),
path('register/', email_auth_views.register_user, name='register'),
path('login/', views.login_user, name='login'),
path('signup/send-otp/', email_auth_views.send_signup_otp, name='signup_send_otp'),
path('signup/verify-otp/', email_auth_views.verify_signup_otp, name='signup_verify_otp'),
path('signup/complete/', email_auth_views.complete_signup, name='signup_complete'),
path('chat/', chat_views.chat, name='chat'),
    

]
