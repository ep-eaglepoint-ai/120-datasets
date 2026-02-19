from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from django.utils import timezone
from datetime import timedelta
from messages_app.models import Message, UserProfile


class Command(BaseCommand):
    help = 'Create test data for the message app'

    def handle(self, *args, **options):
        # Create users
        user1 = User.objects.create_user(username='user1', password='pass')
        user2 = User.objects.create_user(username='user2', password='pass')
        admin = User.objects.create_user(username='admin', password='pass')
        UserProfile.objects.filter(user=admin).update(role=UserProfile.ADMIN_ROLE)

        # Create messages
        Message.objects.create(
            title='Public Message 1',
            content='This is a public message.',
            author=user1
        )

        Message.objects.create(
            title='Public Message 2',
            content='Another public message.',
            author=user2
        )

        Message.objects.create(
            title='Admin Message',
            content='This is an admin message.',
            author=admin
        )

        # Time-locked message
        Message.objects.create(
            title='Time Locked Message',
            content='This message unlocks in 1 hour.',
            author=user1,
            is_locked=True,
            lock_type=Message.TIME_LOCK,
            unlock_time=timezone.now() + timedelta(hours=1)
        )

        # Dependency message
        dep_msg = Message.objects.create(
            title='Dependency Base',
            content='Read this first.',
            author=user1
        )

        Message.objects.create(
            title='Dependency Locked',
            content='This unlocks after reading the dependency.',
            author=user1,
            is_locked=True,
            lock_type=Message.DEPENDENCY_LOCK,
            dependency_message=dep_msg
        )

        # Puzzle message
        Message.objects.create(
            title='Puzzle Message',
            content='Solve the puzzle to unlock.',
            author=user1,
            is_locked=True,
            lock_type=Message.PUZZLE_LOCK,
            puzzle_question='What is 2 + 2?',
            puzzle_answer='4'
        )

        self.stdout.write(self.style.SUCCESS('Test data created successfully'))