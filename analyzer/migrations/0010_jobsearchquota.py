from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("analyzer", "0009_matchscore_analysis_report"),
    ]

    operations = [
        migrations.CreateModel(
            name="JobSearchQuota",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("last_search_at", models.DateTimeField(blank=True, null=True)),
                ("target_role", models.CharField(blank=True, max_length=120)),
                ("experience_level", models.CharField(blank=True, max_length=20)),
                ("location", models.CharField(blank=True, max_length=120)),
                ("results", models.JSONField(blank=True, default=list)),
                ("user", models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name="job_search_quota", to=settings.AUTH_USER_MODEL)),
            ],
        ),
    ]
