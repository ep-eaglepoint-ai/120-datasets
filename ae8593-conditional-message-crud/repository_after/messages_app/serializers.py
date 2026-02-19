from rest_framework import serializers
from .models import Message, UserProfile


class UserProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserProfile
        fields = ['role']


class MessageSerializer(serializers.ModelSerializer):
    author_username = serializers.CharField(source='author.username', read_only=True)
    is_unlocked = serializers.SerializerMethodField()

    class Meta:
        model = Message
        fields = ['id', 'title', 'content', 'author', 'author_username', 'created_at', 'updated_at', 
                  'is_locked', 'lock_type', 'unlock_time', 'dependency_message', 'puzzle_question', 
                  'is_unlocked']
        read_only_fields = ['author', 'created_at', 'updated_at', 'is_unlocked']

    def create(self, validated_data):
        validated_data['author'] = self.context['request'].user
        return super().create(validated_data)

    def get_is_unlocked(self, obj):
        request = self.context.get('request')
        if request and request.user:
            return obj.is_unlocked_for_user(request.user)
        return False