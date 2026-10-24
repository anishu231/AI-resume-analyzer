from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("analyzer", "0007_candidate_user"),
    ]

    operations = [
        migrations.CreateModel(
            name="SignupEmailVerification",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("email", models.EmailField(db_index=True, max_length=254)),
                ("username", models.CharField(max_length=150)),
                ("code_hash", models.CharField(max_length=128)),
                ("expires_at", models.DateTimeField()),
                ("attempts", models.PositiveSmallIntegerField(default=0)),
                ("verified_at", models.DateTimeField(blank=True, null=True)),
                ("greeting_sent_at", models.DateTimeField(blank=True, null=True)),
                ("used_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
            ],
            options={"ordering": ["-created_at"]},
        ),
    ]
