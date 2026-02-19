from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone
from django.db.models.signals import post_save
from django.dispatch import receiver


class UserProfile(models.Model):
    USER_ROLE = 'user'
    ADMIN_ROLE = 'admin'
    ROLE_CHOICES = [
        (USER_ROLE, 'User'),
        (ADMIN_ROLE, 'Admin'),
    ]

    user = models.OneToOneField(User, on_delete=models.CASCADE)
    role = models.CharField(max_length=10, choices=ROLE_CHOICES, default=USER_ROLE)

    def __str__(self):
        return f"{self.user.username} - {self.role}"


@receiver(post_save, sender=User)
def create_user_profile(sender, instance, created, **kwargs):
    if created:
        UserProfile.objects.create(user=instance)


@receiver(post_save, sender=User)
def save_user_profile(sender, instance, **kwargs):
    instance.userprofile.save()


class Message(models.Model):
    TIME_LOCK = 'time'
    DEPENDENCY_LOCK = 'dependency'
    PUZZLE_LOCK = 'puzzle'
    LOCK_CHOICES = [
        (TIME_LOCK, 'Time-based'),
        (DEPENDENCY_LOCK, 'Dependency-based'),
        (PUZZLE_LOCK, 'Puzzle-based'),
    ]

    title = models.CharField(max_length=200)
    content = models.TextField()
    author = models.ForeignKey(User, on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    is_locked = models.BooleanField(default=False)
    lock_type = models.CharField(max_length=20, choices=LOCK_CHOICES, blank=True, null=True)
    unlock_time = models.DateTimeField(blank=True, null=True)
    dependency_message = models.ForeignKey('self', on_delete=models.SET_NULL, blank=True, null=True)
    puzzle_question = models.CharField(max_length=200, blank=True, null=True)
    puzzle_answer = models.CharField(max_length=100, blank=True, null=True)

    def is_unlocked_for_user(self, user):
        if not self.is_locked:
            return True
        if self.lock_type == self.TIME_LOCK:
            return timezone.now() >= self.unlock_time
        elif self.lock_type == self.DEPENDENCY_LOCK:
            if self.dependency_message:
                return self.dependency_message.is_unlocked_for_user(user)
            return True
        elif self.lock_type == self.PUZZLE_LOCK:
            return SolvedPuzzle.objects.filter(user=user, message=self).exists()
        return False

    def __str__(self):
        return self.title


class SolvedPuzzle(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    message = models.ForeignKey(Message, on_delete=models.CASCADE)
    solved_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('user', 'message')

    def __str__(self):
        return f"{self.user.username} solved {self.message.title}"