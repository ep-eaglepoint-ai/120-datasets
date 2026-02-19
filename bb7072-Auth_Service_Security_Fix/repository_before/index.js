const AuthService = require('./authService');

const authService = new AuthService('my-secret-key');

async function main() {
    const registerResult = await authService.register('test@example.com', 'password123');
    console.log('Register:', registerResult);

    const mockSession = {};
    const loginResult = await authService.login('test@example.com', 'password123', mockSession);
    console.log('Login:', loginResult);

    if (loginResult.token) {
        const verifyResult = authService.verifyToken(loginResult.token);
        console.log('Verify:', verifyResult);
    }

    console.log('Auth service initialized successfully');
}

main().catch(console.error);

