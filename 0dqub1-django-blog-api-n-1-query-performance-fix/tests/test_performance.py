import pytest
import time
from django.urls import reverse
from django.contrib.auth.models import User
from django.test.utils import CaptureQueriesContext
from django.db import connection
from rest_framework.test import APIClient
from blog.models import Post, Comment, Tag, Category
import os

REPO_PATH = os.environ.get('REPO_PATH', 'repository_after')

@pytest.fixture
def api_client():
    return APIClient()

# REQUISITES MAPPING (TESTING_PROMPT_FRAMEWORK Compliance)
# REQ-01: Eliminate N+1 queries for all relationship types.
# REQ-02: Total queries < 10 for any pagination page size (50, 100, 200).
# REQ-03: Maintain exact JSON response structure (Identical structure).
# REQ-04: Preserve pagination functionality (offset/limit style).
# REQ-05: Maintain all existing filters (author, category, search).
# REQ-06: Proper select_related/prefetch_related usage for FK/M2M.
# REQ-07: Use database-level aggregations (comment_count, tag_count).
# REQ-08: Memory usage optimization (no over-eager loading of tables).
# REQ-09: Handle empty relationships without extra queries.
# REQ-10: Sub-500ms response time for 50 posts.
# REQ-11: Maintain -created_at ordering for posts and comments.

@pytest.fixture
def setup_blog_data():
    """ Creates a deterministic set of data for testing. """
    from django.utils import timezone
    from datetime import timedelta
    
    # Clear existing data to ensure determinism
    User.objects.all().delete()
    Category.objects.all().delete()
    Tag.objects.all().delete()
    Post.objects.all().delete()
    
    # Create Authors
    authors = [
        User.objects.create_user(username=f"user_{i}", email=f"user_{i}@example.com")
        for i in range(5)
    ]
    
    # Create Categories
    categories = [
        Category.objects.create(name=f"Cat {i}", slug=f"cat-{i}")
        for i in range(3)
    ]
    
    # Create Tags
    tags = [
        Tag.objects.create(name=f"Tag {i}", slug=f"tag-{i}")
        for i in range(10)
    ]
    
    # Create Posts with distinct timestamps
    now = timezone.now()
    posts = []
    # Create 200 posts to test max page size
    for i in range(200):
        # Manually set created_at for deterministic ordering
        post_time = now - timedelta(minutes=i)
        post = Post.objects.create(
            title=f"Post {i}",
            content=f"Content {i}",
            author=authors[i % 5],
            category=categories[i % 3] if i % 4 != 0 else None,
        )
        # Override auto_now_add for testing
        Post.objects.filter(pk=post.pk).update(created_at=post_time)
        post.refresh_from_db()
        
        # Assign 3 tags to each post
        post.tags.set(tags[i % 8 : (i % 8) + 3])
        
        # Create 5 comments for each post with distinct timestamps
        for j in range(5):
            comment_time = post_time - timedelta(seconds=j)
            comment = Comment.objects.create(
                post=post,
                author=authors[j % 5],
                content=f"Comment {j} for post {i}"
            )
            Comment.objects.filter(pk=comment.pk).update(created_at=comment_time)
            
        posts.append(post)
    
    return {
        'authors': authors,
        'categories': categories,
        'tags': tags,
        'posts': posts
    }

def test_tc01_query_count_constancy(api_client, setup_blog_data):
    """
    REQ-01, REQ-02, REQ-06: Verify that total query count is under 10 and constant 
    regardless of page size (50, 100, or 200 posts).
    FAIL_TO_PASS Check: Proves elimination of O(N) complexity.
    """
    if REPO_PATH == 'repository_before':
        pytest.xfail("Constant query count is NOT expected in repository_before due to N+1 problem.")
        
    url = reverse('post-list')
    
    # Adversarial check: verify query count doesn't scale with N
    results = {}
    for page_size in [50, 100, 200]:
        with CaptureQueriesContext(connection) as queries:
            response = api_client.get(url, {'page_size': page_size})
            
        assert response.status_code == 200
        query_count = len(queries)
        results[page_size] = query_count
        
        # Performance check
        assert query_count < 10, f"Page size {page_size} triggered {query_count} queries (Max 10)"
    
    # Determinism check: verify query count is EXACTLY constant for different sizes
    assert abs(results[50] - results[200]) <= 1, "Query count should be independent of result size"

def test_tc10_response_time_benchmarks(api_client, setup_blog_data):
    """
    REQ-10: Achieve sub-500ms for 50, <1s for 100, <2s for 200 posts.
    """
    url = reverse('post-list')
    thresholds = {
        50: 0.5,
        100: 1.0,
        200: 2.0
    }
    
    for size, limit in thresholds.items():
        start = time.time()
        response = api_client.get(url, {'page_size': size})
        duration = time.time() - start
        
        assert response.status_code == 200
        assert duration < limit, f"Response time for {size} posts was {duration:.4f}s (Limit {limit}s)"

def test_tc02_json_structure_integrity(api_client, setup_blog_data):
    """
    REQ-03: Maintain exact JSON response structure including nested objects and counts.
    ADVERSARIAL: Deep property check to catch lazy 'partial' objects.
    PASS_TO_PASS
    """
    if REPO_PATH == 'repository_before':
        # The 'before' version has a bug where dual annotation without distinct=True causes count multiplication (15 vs 5)
        pytest.xfail("JSON counts are broken in repository_before due to missing distinct=True in annotations.")
        
    url = reverse('post-list')
    response = api_client.get(url, {'page_size': 1})
    
    assert response.status_code == 200
    data = response.data['results'][0]
    
    # Exhaustive field check
    expected_fields = [
        'id', 'title', 'content', 'author', 'category', 'tags', 
        'comment_count', 'tag_count', 'recent_comments', 'created_at', 'updated_at'
    ]
    for field in expected_fields:
        assert field in data, f"Required field '{field}' missing from response"
    
    # Deep structure verification for the author (Forward FK)
    assert isinstance(data['author'], dict)
    assert set(data['author'].keys()) == {'id', 'username', 'email'}
    
    # Deep structure verification for tags (M2M)
    assert isinstance(data['tags'], list)
    if data['tags']:
        assert set(data['tags'][0].keys()) == {'id', 'name', 'slug'}
        
    # Validating content of counts matches database (REQ-07)
    # Post index 0 has 5 comments and 3 tags (per setup_blog_data)
    assert data['comment_count'] == 5
    assert data['tag_count'] == 3

def test_tc03_pagination_accuracy(api_client, setup_blog_data):
    """
    REQ-05: Preserve DRF pagination functionality.
    PASS_TO_PASS
    """
    url = reverse('post-list')
    response = api_client.get(url, {'page_size': 50, 'offset': 50})
    
    assert response.status_code == 200
    assert response.data['count'] == 200
    assert len(response.data['results']) == 50
    assert 'next' in response.data
    assert 'previous' in response.data

def test_tc04_filters_compatibility(api_client, setup_blog_data):
    """
    REQ-06: Existing filters must continue working without N+1.
    """
    if REPO_PATH == 'repository_before':
        pytest.xfail("Filtering triggers N+1 queries in repository_before.")
        
    url = reverse('post-list')
    author_id = setup_blog_data['authors'][0].id
    
    with CaptureQueriesContext(connection) as queries:
        response = api_client.get(url, {'author': author_id})
    
    assert response.status_code == 200
    assert len(queries) < 10
    
    # Verify filter works
    for post in response.data['results']:
        assert post['author']['id'] == author_id

def test_tc05_ordering_preservation(api_client, setup_blog_data):
    """
    REQ-09: Maintain -created_at ordering for posts and comments.
    PASS_TO_PASS
    """
    url = reverse('post-list')
    response = api_client.get(url)
    
    results = response.data['results']
    # Check post ordering (descending created_at)
    for i in range(len(results) - 1):
        assert results[i]['created_at'] >= results[i+1]['created_at']
        
    # Check comment ordering within a post
    post = results[0]
    comments = post['recent_comments']
    for i in range(len(comments) - 1):
        assert comments[i]['created_at'] >= comments[i+1]['created_at']

def test_tc06_empty_relationships(api_client, setup_blog_data):
    """
    REQ-08: Handle posts without categories, authors, comments, or tags gracefully.
    """
    # Create an empty post
    empty_author = User.objects.create_user(username="ghost", email="ghost@ex.com")
    empty_post = Post.objects.create(
        title="Empty Post",
        content="No tags or comments here",
        author=empty_author,
        category=None
    )
    
    url = reverse('post-list')
    response = api_client.get(url, {'search': 'Empty Post'})
    
    assert response.status_code == 200
    data = response.data['results'][0]
    assert data['category'] is None
    assert data['tags'] == []
    assert data['recent_comments'] == []
    assert data['comment_count'] == 0
    assert data['tag_count'] == 0

def test_tc07_nested_prefetch_optimization(api_client, setup_blog_data):
    """
    REQ-01, REQ-06: Verify that nested author in recent_comments doesn't trigger N+1.
    ADVERSARIAL: Checks that even multi-level nesting is optimized.
    FAIL_TO_PASS: Proves nested Prefetch optimization.
    """
    if REPO_PATH == 'repository_before':
        pytest.xfail("Nested relationships (comment authors) trigger extra queries in repository_before.")
        
    url = reverse('post-list')
    
    with CaptureQueriesContext(connection) as queries:
        # Fetch 10 posts, each with 3 recent comments
        # If not optimized, this would trigger 30 extra queries for comment authors!
        response = api_client.get(url, {'page_size': 10})
        
    assert response.status_code == 200
    # Expected queries: 
    # 1. Count
    # 2. Posts (select_related author/category)
    # 3. Tags
    # 4. Comments (select_related author)
    # Total: 4
    assert len(queries) < 10, f"Nested relationships triggered {len(queries)} queries"

def test_tc08_negative_filters(api_client, setup_blog_data):
    """
    ADVERSARIAL: Verify that invalid filters return empty results but still run optimized queries.
    """
    url = reverse('post-list')
    
    with CaptureQueriesContext(connection) as queries:
        response = api_client.get(url, {'author': 9999, 'category': 'non-existent'})
    
    assert response.status_code == 200
    assert response.data['count'] == 0
    assert len(queries) < 10

def test_tc09_search_functionality(api_client, setup_blog_data):
    """
    REQ-05: search=? must work and remain optimized.
    """
    url = reverse('post-list')
    
    with CaptureQueriesContext(connection) as queries:
        response = api_client.get(url, {'search': 'Post 100'})
    
    assert response.status_code == 200
    assert response.data['count'] >= 1
    assert 'Post 100' in response.data['results'][0]['title']
    assert len(queries) < 10
