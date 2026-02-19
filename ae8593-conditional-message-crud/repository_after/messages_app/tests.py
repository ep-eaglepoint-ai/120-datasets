from django.test import TestCase
from django.contrib.auth.models import User
from django.utils import timezone
from datetime import timedelta
from .models import Message, UserProfile


class MessageModelTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='testuser', password='12345')
        self.admin_user = User.objects.create_user(username='admin', password='12345')
        UserProfile.objects.filter(user=self.admin_user).update(role=UserProfile.ADMIN_ROLE)
        
        self.message = Message.objects.create(
            title='Test Message',
            content='Test content',
            author=self.user
        )
        
        self.locked_time_message = Message.objects.create(
            title='Locked Time Message',
            content='Locked content',
            author=self.user,
            is_locked=True,
            lock_type=Message.TIME_LOCK,
            unlock_time=timezone.now() + timedelta(hours=1)
        )
        
        self.unlocked_time_message = Message.objects.create(
            title='Unlocked Time Message',
            content='Unlocked content',
            author=self.user,
            is_locked=True,
            lock_type=Message.TIME_LOCK,
            unlock_time=timezone.now() - timedelta(hours=1)
        )

    def test_message_creation(self):
        self.assertEqual(self.message.title, 'Test Message')
        self.assertEqual(self.message.author, self.user)
        self.assertFalse(self.message.is_locked)

    def test_time_based_unlock(self):
        # Locked message should not be unlocked
        self.assertFalse(self.locked_time_message.is_unlocked_for_user(self.user))
        # Unlocked message should be unlocked
        self.assertTrue(self.unlocked_time_message.is_unlocked_for_user(self.user))

    def test_dependency_based_unlock(self):
        dependency_message = Message.objects.create(
            title='Dependency',
            content='Dependency content',
            author=self.user
        )
        locked_dep_message = Message.objects.create(
            title='Locked Dep Message',
            content='Locked dep content',
            author=self.user,
            is_locked=True,
            lock_type=Message.DEPENDENCY_LOCK,
            dependency_message=dependency_message
        )
        # Should be unlocked since dependency is unlocked
        self.assertTrue(locked_dep_message.is_unlocked_for_user(self.user))


class MessageViewTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='testuser', password='12345')
        self.admin_user = User.objects.create_user(username='admin', password='12345')
        UserProfile.objects.filter(user=self.admin_user).update(role=UserProfile.ADMIN_ROLE)
        
        self.message = Message.objects.create(
            title='Test Message',
            content='Test content',
            author=self.user
        )
        
        self.admin_message = Message.objects.create(
            title='Admin Message',
            content='Admin content',
            author=self.admin_user
        )

    def test_message_list_api(self):
        self.client.login(username='testuser', password='12345')
        response = self.client.get('/api/messages/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 2)  # Should see both messages
        
        # Test user tab
        response = self.client.get('/api/messages/?tab=user')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)  # Only user's message
        
        # Test admin tab
        response = self.client.get('/api/messages/?tab=admin')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)  # Only admin's message