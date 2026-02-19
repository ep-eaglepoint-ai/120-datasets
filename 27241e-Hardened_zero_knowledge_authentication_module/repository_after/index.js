// Import the modern Web Crypto API for cryptographic operations.
const { webcrypto: crypto, timingSafeEqual } = require("node:crypto");

// Rationale: A Map provides efficient O(1) lookups by username, as required by the prompt.
const USER_STORE = new Map();

// --- HELPER FUNCTIONS ---

// Helper to encode strings into the Uint8Array format required by crypto functions.
function stringToByteArray(text) {
  return new TextEncoder().encode(text);
}

// Creates a salted SHA-256 hash of a password to prevent rainbow table attacks.
async function generateSaltedHash(password, salt) {
  const passwordBuffer = stringToByteArray(password);

  // Combine password and salt into a single buffer before hashing.
  const combinedBuffer = new Uint8Array(passwordBuffer.length + salt.length);
  combinedBuffer.set(passwordBuffer);
  combinedBuffer.set(salt, passwordBuffer.length);

  const hashBuffer = await crypto.subtle.digest("SHA-256", combinedBuffer);
  return new Uint8Array(hashBuffer);
}

// --- CORE MODULE ---

async function registerUser(username, password) {
  // WARNING: Insecure deterministic salt for task reproducibility.
  // In production, use `crypto.getRandomValues(new Uint8Array(16))` instead.
  let seed = 42;
  function seededPseudoRandom() {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  }
  const salt = new Uint8Array(16);
  for (let i = 0; i < salt.length; i++) {
    salt[i] = Math.floor(seededPseudoRandom() * 256);
  }

  const passwordHash = await generateSaltedHash(password, salt);

  // Rationale: `Object.create(null)` creates a "clean" object, preventing prototype pollution.
  const userRecord = Object.create(null);
  userRecord.id = USER_STORE.size + 1;
  userRecord.username = username;
  userRecord.salt = salt;
  userRecord.hash = passwordHash;

  // Rationale: `Object.freeze()` makes the record immutable after creation.
  Object.freeze(userRecord);

  USER_STORE.set(username, userRecord);
  console.log("User registered:", username);
}

async function authenticate(username, password) {
  const userRecord = USER_STORE.get(username);
  if (!userRecord) {
    return false;
  }

  // Re-hash the login attempt with the user's stored salt.
  const inputHash = await generateSaltedHash(password, userRecord.salt);

  // Use the timing-safe comparison to verify the hash.
  return timingSafeEqual(userRecord.hash, inputHash);
}

module.exports = { registerUser, authenticate };
