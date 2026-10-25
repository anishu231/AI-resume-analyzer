from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("analyzer", "0010_jobsearchquota"),
    ]

    operations = [
        migrations.CreateModel(
            name="JobSearchProviderUsage",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("source", models.CharField(max_length=20)),
                ("bucket", models.CharField(max_length=48)),
                ("calls", models.PositiveIntegerField(default=0)),
            ],
            options={
                "constraints": [
                    models.UniqueConstraint(fields=("source", "bucket"), name="unique_job_search_provider_bucket"),
                ],
            },
        ),
    ]
