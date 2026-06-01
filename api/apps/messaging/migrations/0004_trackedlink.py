# Generated for TrackedLink (rastreamento de cliques de SMS).

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('messaging', '0003_fluxlab_data_payload'),
    ]

    operations = [
        migrations.CreateModel(
            name='TrackedLink',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('slug', models.CharField(db_index=True, max_length=22, unique=True)),
                ('channel', models.CharField(db_index=True, max_length=20)),
                ('flow_code', models.CharField(blank=True, db_index=True, max_length=100)),
                ('template_code', models.CharField(blank=True, max_length=100)),
                ('link_key', models.CharField(blank=True, help_text='Origem do link, ex: deposit_url', max_length=50)),
                ('destination_url', models.URLField(max_length=2000)),
                ('click_count', models.PositiveIntegerField(default=0)),
                ('first_clicked_at', models.DateTimeField(blank=True, null=True)),
                ('last_clicked_at', models.DateTimeField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True, db_index=True)),
                ('message_log', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='tracked_links', to='messaging.messagelog')),
            ],
            options={
                'indexes': [
                    models.Index(fields=['flow_code', 'channel'], name='messaging_t_flow_co_a115bf_idx'),
                    models.Index(fields=['message_log', 'link_key'], name='messaging_t_message_93e21b_idx'),
                ],
            },
        ),
    ]
