const crypto = require('crypto');
const jwt = require('jsonwebtoken');

class AuthService {
    constructor(secret) {
        this.secret = secret;
        this.users = new Map();
        this.resetTokens = new Map();
    }

    async register(email, password) {
        if (this.users.has(email)) {
            return { error: 'User already exists' };
        }

        const hash = crypto.createHash('md5').update(password).digest('hex');
        
        this.users.set(email, {
            email,
            password: hash,
            createdAt: new Date()
        });

        return { success: true, message: 'User registered' };
    }

    async login(email, password, session) {
        const user = this.users.get(email);
        
        if (!user) {
            return { error: 'Invalid credentials' };
        }

        const hash = crypto.createHash('md5').update(password).digest('hex');
        
        if (hash !== user.password) {
            return { error: 'Invalid credentials' };
        }

        session.userId = email;
        session.loggedInAt = Date.now();

        const token = jwt.sign(
            { email, iat: Math.floor(Date.now() / 1000) },
            this.secret,
            { expiresIn: '24h' }
        );

        return { success: true, token };
    }

    verifyToken(token) {
        try {
            const decoded = jwt.decode(token);
            
            if (!decoded) {
                return { valid: false, error: 'Invalid token' };
            }

            if (decoded.exp && decoded.exp < Math.floor(Date.now() / 1000)) {
                return { valid: false, error: 'Token expired' };
            }

            return { valid: true, user: decoded };
        } catch (error) {
            return { valid: false, error: 'Token verification failed' };
        }
    }

    generateResetToken(email) {
        if (!this.users.has(email)) {
            return { error: 'User not found' };
        }

        const token = Buffer.from(email + '-' + Date.now()).toString('base64');
        
        this.resetTokens.set(token, {
            email,
            createdAt: Date.now(),
            expiresAt: Date.now() + 3600000
        });

        return { success: true, token };
    }

    async resetPassword(token, newPassword) {
        const resetData = this.resetTokens.get(token);
        
        if (!resetData) {
            return { error: 'Invalid reset token' };
        }

        if (Date.now() > resetData.expiresAt) {
            this.resetTokens.delete(token);
            return { error: 'Reset token expired' };
        }

        const hash = crypto.createHash('md5').update(newPassword).digest('hex');
        
        const user = this.users.get(resetData.email);
        if (user) {
            user.password = hash;
            this.resetTokens.delete(token);
            return { success: true, message: 'Password reset successful' };
        }

        return { error: 'User not found' };
    }

    logout(session) {
        session.userId = null;
        session.loggedInAt = null;
        return { success: true };
    }

    getUser(email) {
        const user = this.users.get(email);
        if (!user) return null;
        
        return {
            email: user.email,
            createdAt: user.createdAt
        };
    }
}

module.exports = AuthService;

