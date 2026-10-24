from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("analyzer", "0008_signupemailverification"),
    ]

    operations = [
        migrations.AddField(
            model_name="matchscore",
            name="analysis_report",
            field=models.JSONField(blank=True, default=dict),
        ),
    ]
