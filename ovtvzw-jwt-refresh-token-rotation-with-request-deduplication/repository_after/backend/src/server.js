import express from 'express';
import jwt from 'jsonwebtoken';

const app = express();

// CORS middleware (no external libraries as per requirements)
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json());

const JWT_SECRET = 'test-secret-key-for-jwt-signing';
const TOKEN_EXPIRY_SECONDS = 3;

let currentTokenVersion = 0;

function generateToken() {
  currentTokenVersion++;
  return jwt.sign(
    { 
      userId: 'user-123',
      version: currentTokenVersion,
      iat: Math.floor(Date.now() / 1000)
    },
    JWT_SECRET,
    { expiresIn: `${TOKEN_EXPIRY_SECONDS}s` }
  );
}

function verifyToken(token) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return { valid: true, decoded };
  } catch (error) {
    return { valid: false, error: error.message };
  }
}

function extractToken(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.substring(7);
}

function authMiddleware(req, res, next) {
  const token = extractToken(req);
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  const result = verifyToken(token);
  
  if (!result.valid) {
    return res.status(401).json({ error: 'Token expired or invalid', details: result.error });
  }
  
  req.user = result.decoded;
  next();
}

app.post('/api/login', (req, res) => {
  const token = generateToken();
  const refreshToken = jwt.sign(
    { userId: 'user-123', type: 'refresh' },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
  
  res.json({ 
    accessToken: token,
    refreshToken: refreshToken,
    expiresIn: TOKEN_EXPIRY_SECONDS
  });
});

app.post('/api/refresh', async (req, res) => {
  const delay = Math.floor(Math.random() * 200) + 100;
  await new Promise(resolve => setTimeout(resolve, delay));
  
  const { refreshToken } = req.body;
  
  if (!refreshToken) {
    return res.status(401).json({ error: 'No refresh token provided' });
  }
  
  try {
    const decoded = jwt.verify(refreshToken, JWT_SECRET);
    
    if (decoded.type !== 'refresh') {
      return res.status(401).json({ error: 'Invalid refresh token type' });
    }
    
    const newAccessToken = generateToken();
    const newRefreshToken = jwt.sign(
      { userId: decoded.userId, type: 'refresh' },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
    
    res.json({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      expiresIn: TOKEN_EXPIRY_SECONDS
    });
  } catch (error) {
    return res.status(401).json({ error: 'Refresh token expired or invalid' });
  }
});

app.get('/api/data', authMiddleware, (req, res) => {
  res.json({
    message: 'Protected data retrieved successfully',
    data: {
      items: ['item1', 'item2', 'item3'],
      timestamp: new Date().toISOString(),
      userId: req.user.userId
    }
  });
});

app.get('/api/data/:id', authMiddleware, (req, res) => {
  res.json({
    message: `Data for item ${req.params.id}`,
    data: {
      id: req.params.id,
      name: `Item ${req.params.id}`,
      timestamp: new Date().toISOString()
    }
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

const PORT = process.env.PORT || 3000;

let server;

export function startServer(port = PORT) {
  return new Promise((resolve) => {
    server = app.listen(port, () => {
      console.log(`Server running on port ${port}`);
      resolve(server);
    });
  });
}

export function stopServer() {
  return new Promise((resolve) => {
    if (server) {
      server.close(() => {
        resolve();
      });
    } else {
      resolve();
    }
  });
}

export { app, generateToken, verifyToken, JWT_SECRET, TOKEN_EXPIRY_SECONDS };

if (process.argv[1] && process.argv[1].endsWith('server.js')) {
  startServer();
}
