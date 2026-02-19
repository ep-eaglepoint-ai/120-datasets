import { POST as registerHandler } from '@/app/api/auth/register/route';
import { POST as loginHandler } from '@/app/api/auth/login/route';
import { POST as logoutHandler } from '@/app/api/auth/logout/route';

/**
 * REQ-04: Handle session creation, persistence and validation
 * REQ-05: Handling clearing sessions
 */
describe('TC-03: API Authentication Flow', () => {
  const newUser = {
    username: 'apiuser',
    email: 'api@example.com',
    password: 'password123'
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('REQ-04: registration should create session', async () => {
    const request = new Request('http://localhost/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(newUser),
    });

    const response = await registerHandler(request);
    expect(response.status).toBe(201);
    
    // Check if session cookie was set via the mock
    expect((global as any).mockCookiesStore.set).toHaveBeenCalledWith(
      'auth_session',
      expect.any(String),
      expect.any(Object)
    );
  });

  test('REQ-03 & REQ-04: login with email should create session', async () => {
    const request = new Request('http://localhost/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        identifier: newUser.email,
        password: newUser.password
      }),
    });

    const response = await loginHandler(request);
    expect(response.status).toBe(200);
    
    expect((global as any).mockCookiesStore.set).toHaveBeenCalledWith(
      'auth_session',
      expect.any(String),
      expect.any(Object)
    );
  });

  test('REQ-05: logout should clear session', async () => {
    const response = await logoutHandler();
    expect(response.status).toBe(200);
    
    expect((global as any).mockCookiesStore.delete).toHaveBeenCalledWith('auth_session');
  });
});
