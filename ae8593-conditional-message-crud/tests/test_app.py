import pytest
from django.test import Client
from django.contrib.auth.models import User
from django.utils import timezone
from datetime import timedelta
from messages_app.models import Message, UserProfile, SolvedPuzzle


@pytest.fixture
def client():
    return Client()


@pytest.fixture
def user():
    user = User.objects.create_user(username='testuser', password='password')
    return user


@pytest.fixture
def admin_user():
    user = User.objects.create_user(username='admin', password='password')
    profile = UserProfile.objects.get(user=user)
    profile.role = UserProfile.ADMIN_ROLE
    profile.save()
    return user


@pytest.fixture
def message(user):
    return Message.objects.create(
        title='Test Message',
        content='Test content',
        author=user
    )


@pytest.fixture
def locked_time_message(user):
    return Message.objects.create(
        title='Time Locked',
        content='Locked content',
        author=user,
        is_locked=True,
        lock_type=Message.TIME_LOCK,
        unlock_time=timezone.now() + timedelta(hours=1)
    )


@pytest.fixture
def unlocked_time_message(user):
    return Message.objects.create(
        title='Time Unlocked',
        content='Unlocked content',
        author=user,
        is_locked=True,
        lock_type=Message.TIME_LOCK,
        unlock_time=timezone.now() - timedelta(hours=1)
    )


@pytest.fixture
def dependency_message(user):
    return Message.objects.create(
        title='Dependency Base',
        content='Base content',
        author=user,
        is_locked=True,
        lock_type=Message.PUZZLE_LOCK,  # Make it locked by puzzle
        puzzle_question='What is 1+1?',
        puzzle_answer='2'
    )


@pytest.fixture
def locked_dependency_message(user, dependency_message):
    return Message.objects.create(
        title='Dependency Locked',
        content='Locked by dependency',
        author=user,
        is_locked=True,
        lock_type=Message.DEPENDENCY_LOCK,
        dependency_message=dependency_message
    )


@pytest.fixture
def puzzle_message(user):
    return Message.objects.create(
        title='Puzzle Message',
        content='Solve to unlock',
        author=user,
        is_locked=True,
        lock_type=Message.PUZZLE_LOCK,
        puzzle_question='What is 2+2?',
        puzzle_answer='4'
    )


@pytest.mark.django_db
class TestAuthentication:
    def test_user_profile_creation(self, user):
        profile = UserProfile.objects.get(user=user)
        assert profile.role == UserProfile.USER_ROLE


@pytest.mark.django_db
class TestCRUDOperations:
    def test_create_message(self, client, user):
        client.login(username='testuser', password='password')
        response = client.post('/create/', {
            'title': 'New Message',
            'content': 'New content'
        })
        assert response.status_code == 302  # Redirect after success
        assert Message.objects.filter(title='New Message').exists()

    def test_read_message(self, client, user, message):
        client.login(username='testuser', password='password')
        response = client.get('/')
        assert response.status_code == 200
        assert 'Test Message' in response.content.decode()

    def test_update_message(self, client, user, message):
        client.login(username='testuser', password='password')
        response = client.post(f'/{message.pk}/update/', {
            'title': 'Updated Title',
            'content': 'Updated content'
        })
        assert response.status_code == 302
        message.refresh_from_db()
        assert message.title == 'Updated Title'

    def test_delete_message(self, client, user, message):
        client.login(username='testuser', password='password')
        response = client.post(f'/{message.pk}/delete/')
        assert response.status_code == 302
        assert not Message.objects.filter(pk=message.pk).exists()


@pytest.mark.django_db
class TestRoleBasedVisibility:
    def test_all_messages_tab(self, client, user, admin_user, message):
        client.login(username='testuser', password='password')
        response = client.get('/api/messages/?tab=all')
        assert response.status_code == 200
        assert len(response.data) >= 1

    def test_user_messages_tab(self, client, user, message):
        client.login(username='testuser', password='password')
        response = client.get('/api/messages/?tab=user')
        assert response.status_code == 200
        assert len(response.data) == 1
        assert response.data[0]['title'] == 'Test Message'

    def test_admin_messages_tab(self, client, user, admin_user):
        admin_message = Message.objects.create(
            title='Admin Msg',
            content='Admin content',
            author=admin_user
        )
        client.login(username='testuser', password='password')
        response = client.get('/api/messages/?tab=admin')
        assert response.status_code == 200
        assert len(response.data) == 1
        assert response.data[0]['title'] == 'Admin Msg'


@pytest.mark.django_db
class TestConditionalUnlocking:
    def test_time_based_unlock_locked(self, user, locked_time_message):
        assert not locked_time_message.is_unlocked_for_user(user)

    def test_time_based_unlock_unlocked(self, user, unlocked_time_message):
        assert unlocked_time_message.is_unlocked_for_user(user)

    def test_dependency_based_unlock(self, user, dependency_message, locked_dependency_message):
        # Initially both locked
        assert not dependency_message.is_unlocked_for_user(user)
        assert not locked_dependency_message.is_unlocked_for_user(user)
        
        # Simulate unlocking dependency by creating SolvedPuzzle
        SolvedPuzzle.objects.create(user=user, message=dependency_message)
        
        # Now dependency is unlocked, so locked one should be unlocked
        assert dependency_message.is_unlocked_for_user(user)
        assert locked_dependency_message.is_unlocked_for_user(user)

    def test_puzzle_based_unlock(self, user, puzzle_message):
        # Initially locked
        assert not puzzle_message.is_unlocked_for_user(user)
        
        # Simulate solving puzzle
        SolvedPuzzle.objects.create(user=user, message=puzzle_message)
        
        # Now should be unlocked
        assert puzzle_message.is_unlocked_for_user(user)


@pytest.mark.django_db
class TestAPIFunctionality:
    def test_api_list_messages(self, client, user, message):
        client.login(username='testuser', password='password')
        response = client.get('/api/messages/')
        assert response.status_code == 200
        assert isinstance(response.data, list)

    def test_api_create_message(self, client, user):
        client.login(username='testuser', password='password')
        response = client.post('/api/messages/', {
            'title': 'API Message',
            'content': 'API content'
        })
        assert response.status_code == 201
        assert Message.objects.filter(title='API Message').exists()

    def test_api_update_message(self, client, user, message):
        client.login(username='testuser', password='password')
        response = client.put(f'/api/messages/{message.pk}/', {
            'title': 'Updated API',
            'content': 'Updated content'
        }, content_type='application/json')
        assert response.status_code == 200
        message.refresh_from_db()
        assert message.title == 'Updated API'

    def test_api_delete_message(self, client, user, message):
        client.login(username='testuser', password='password')
        response = client.delete(f'/api/messages/{message.pk}/')
        assert response.status_code == 204
        assert not Message.objects.filter(pk=message.pk).exists()


if __name__ == '__main__':
    pytest.main([__file__, '-v'])