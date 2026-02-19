from django.apps import AppConfig


class MessagesAppConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'messages_app'

    def ready(self):
        import messages_app.models  # noqa