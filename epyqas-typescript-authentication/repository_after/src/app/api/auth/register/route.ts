import { NextResponse } from 'next/server';
import { findUserByEmail, findUserByUsername, createUser } from '@/lib/db';
import { hashPassword } from '@/lib/auth/password';
import { createSession } from '@/lib/auth/session';

export async function POST(request: Request) {
  try {
    const { username, email, password } = await request.json();

    // Basic validation
    if (!username || !email || !password) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters long' },
        { status: 400 }
      );
    }

    // Check if user already exists
    if (findUserByEmail(email)) {
      return NextResponse.json(
        { error: 'Email already exists' },
        { status: 400 }
      );
    }

    if (findUserByUsername(username)) {
      return NextResponse.json(
        { error: 'Username already taken' },
        { status: 400 }
      );
    }

    // Hash password and create user
    const passwordHash = hashPassword(password);
    const user = createUser({
      username,
      email,
      passwordHash,
    });

    // Create session
    await createSession(user.id, user.username);

    return NextResponse.json(
      { message: 'User registered successfully', userId: user.id },
      { status: 201 }
    );
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
