from rest_framework import viewsets, filters
from rest_framework.pagination import PageNumberPagination
from django.db.models import Count
from .models import Post
from .serializers import PostSerializer

class PostPagination(PageNumberPagination):
    page_size = 50
    page_size_query_param = 'page_size'
    max_page_size = 200

class PostViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = PostSerializer
    pagination_class = PostPagination
    filter_backends = [filters.SearchFilter]
    search_fields = ['title', 'content']
    
    def get_queryset(self):
        queryset = Post.objects.all()
        
        queryset = queryset.annotate(
            comment_count=Count('comments'),
            tag_count=Count('tags')
        )
        
        author_id = self.request.query_params.get('author')
        if author_id:
            queryset = queryset.filter(author_id=author_id)
        
        category_slug = self.request.query_params.get('category')
        if category_slug:
            queryset = queryset.filter(category__slug=category_slug)
        
        return queryset

