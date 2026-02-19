from django.contrib import admin
from .models import Message, UserProfile, SolvedPuzzle

admin.site.register(Message)
admin.site.register(UserProfile)
admin.site.register(SolvedPuzzle)