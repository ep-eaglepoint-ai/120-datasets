from rest_framework import serializers
from .models import Post, Comment, Tag, Category
from django.contrib.auth.models import User

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email']

class TagSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tag
        fields = ['id', 'name', 'slug']

class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ['id', 'name', 'slug']

class CommentSerializer(serializers.ModelSerializer):
    author = UserSerializer(read_only=True)
    
    class Meta:
        model = Comment
        fields = ['id', 'author', 'content', 'created_at']

class PostSerializer(serializers.ModelSerializer):
    author = UserSerializer(read_only=True)
    category = CategorySerializer(read_only=True)
    tags = TagSerializer(many=True, read_only=True)
    recent_comments = serializers.SerializerMethodField()
    comment_count = serializers.IntegerField(read_only=True)
    tag_count = serializers.IntegerField(read_only=True)
    
    class Meta:
        model = Post
        fields = ['id', 'title', 'content', 'author', 'category', 'tags', 
                  'comment_count', 'tag_count', 'recent_comments', 'created_at', 'updated_at']
    
    def get_recent_comments(self, obj):
        comments = obj.comments.all()[:3]
        return CommentSerializer(comments, many=True).data

