// Legacy Insecure Auth
const USERS = [];

async function registerUser(username, password) {
  const user = {
    id: USERS.length + 1,
    username: username,
    password: password, // Plain text!
  };
  USERS.push(user);
  console.log("User registered:", username);
}

async function authenticate(username, password) {
  for (let i = 0; i < USERS.length; i++) {
    if (USERS[i].username === username && USERS[i].password === password) {
      return true;
    }
  }
  return false;
}

module.exports = { registerUser, authenticate };
