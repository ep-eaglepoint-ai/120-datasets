from django.shortcuts import render, get_object_or_404, redirect
from django.contrib.auth.decorators import login_required
from django.contrib.auth.mixins import LoginRequiredMixin
from django.views.generic import ListView, DetailView, CreateView, UpdateView, DeleteView
from django.urls import reverse_lazy
from django.contrib import messages
from rest_framework import viewsets, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import Message, UserProfile, SolvedPuzzle
from .serializers import MessageSerializer


class MessageViewSet(viewsets.ModelViewSet):
    queryset = Message.objects.all()
    serializer_class = MessageSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        queryset = Message.objects.all()
        
        # Filter based on tab
        tab = self.request.query_params.get('tab', 'all')
        if tab == 'user':
            queryset = queryset.filter(author=user)
        elif tab == 'admin':
            admin_users = UserProfile.objects.filter(role=UserProfile.ADMIN_ROLE).values_list('user', flat=True)
            queryset = queryset.filter(author__in=admin_users)
        
        # Only show unlocked messages
        unlocked_messages = []
        for message in queryset:
            if message.is_unlocked_for_user(user):
                unlocked_messages.append(message.id)
        return queryset.filter(id__in=unlocked_messages)

    @action(detail=True, methods=['post'])
    def unlock_puzzle(self, request, pk=None):
        message = self.get_object()
        if message.lock_type == Message.PUZZLE_LOCK:
            answer = request.data.get('answer')
            if answer == message.puzzle_answer:
                SolvedPuzzle.objects.get_or_create(user=request.user, message=message)
                return Response({'status': 'unlocked'})
        return Response({'status': 'failed'}, status=400)


@login_required
def dashboard(request):
    user_profile = UserProfile.objects.get_or_create(user=request.user)[0]
    
    # All messages (unlocked)
    all_messages = Message.objects.filter(
        id__in=[m.id for m in Message.objects.all() if m.is_unlocked_for_user(request.user)]
    )
    
    # User messages
    user_messages = Message.objects.filter(author=request.user)
    
    # Admin messages
    admin_users = UserProfile.objects.filter(role=UserProfile.ADMIN_ROLE).values_list('user', flat=True)
    admin_messages = Message.objects.filter(author__in=admin_users)
    
    context = {
        'all_messages': all_messages,
        'user_messages': user_messages,
        'admin_messages': admin_messages,
        'user_role': user_profile.role,
    }
    return render(request, 'messages_app/dashboard.html', context)


class MessageCreateView(LoginRequiredMixin, CreateView):
    model = Message
    fields = ['title', 'content', 'is_locked', 'lock_type', 'unlock_time', 'dependency_message', 'puzzle_question', 'puzzle_answer']
    template_name = 'messages_app/message_form.html'
    success_url = reverse_lazy('dashboard')

    def form_valid(self, form):
        form.instance.author = self.request.user
        return super().form_valid(form)


class MessageUpdateView(LoginRequiredMixin, UpdateView):
    model = Message
    fields = ['title', 'content', 'is_locked', 'lock_type', 'unlock_time', 'dependency_message', 'puzzle_question', 'puzzle_answer']
    template_name = 'messages_app/message_form.html'
    success_url = reverse_lazy('dashboard')

    def get_queryset(self):
        return Message.objects.filter(author=self.request.user)


class MessageDeleteView(LoginRequiredMixin, DeleteView):
    model = Message
    template_name = 'messages_app/message_confirm_delete.html'
    success_url = reverse_lazy('dashboard')

    def get_queryset(self):
        return Message.objects.filter(author=self.request.user)