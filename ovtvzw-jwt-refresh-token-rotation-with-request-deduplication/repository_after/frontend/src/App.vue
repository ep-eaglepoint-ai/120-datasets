<script setup>
import { ref, computed } from 'vue'
import { useAuthFetch, getTokens, setTokens, clearTokens } from './composables/useAuthFetch'

const { get, post, isLoading, error } = useAuthFetch()

const isLoggedIn = computed(() => !!getTokens().accessToken)
const data = ref(null)
const logs = ref([])
const concurrentResults = ref([])

function log(message) {
  const timestamp = new Date().toLocaleTimeString()
  logs.value.unshift(`[${timestamp}] ${message}`)
  if (logs.value.length > 20) logs.value.pop()
}

async function login() {
  try {
    log('Attempting login...')
    const response = await post('/api/login', {})
    setTokens(response.accessToken, response.refreshToken)
    log(`Login successful! Token expires in ${response.expiresIn}s`)
  } catch (err) {
    log(`Login failed: ${err.message}`)
  }
}

async function fetchData() {
  try {
    log('Fetching protected data...')
    const response = await get('/api/data')
    data.value = response
    log('Data fetched successfully!')
  } catch (err) {
    log(`Fetch failed: ${err.message}`)
  }
}

async function testThunderingHerd() {
  log('🔥 Testing Thundering Herd: Sending 10 concurrent requests...')
  concurrentResults.value = []
  
  const promises = Array(10).fill(null).map((_, i) => 
    get(`/api/data/${i + 1}`)
      .then(res => {
        log(`Request ${i + 1} succeeded`)
        return { id: i + 1, status: 'success', data: res }
      })
      .catch(err => {
        log(`Request ${i + 1} failed: ${err.message}`)
        return { id: i + 1, status: 'failed', error: err.message }
      })
  )
  
  concurrentResults.value = await Promise.all(promises)
  log(`Thundering Herd test complete: ${concurrentResults.value.filter(r => r.status === 'success').length}/10 succeeded`)
}

function logout() {
  clearTokens()
  data.value = null
  concurrentResults.value = []
  log('Logged out')
}

async function waitForTokenExpiry() {
  log('Waiting 4 seconds for token to expire...')
  await new Promise(resolve => setTimeout(resolve, 4000))
  log('Token should be expired now. Try fetching data!')
}
</script>

<template>
  <div class="container">
    <h1>🔐 JWT Refresh Token Demo</h1>
    <p class="subtitle">Testing Thundering Herd Prevention with Singleton Promise Pattern</p>
    
    <div class="status-bar">
      <span :class="['status', isLoggedIn ? 'online' : 'offline']">
        {{ isLoggedIn ? '● Logged In' : '○ Not Logged In' }}
      </span>
      <span v-if="isLoading" class="loading">Loading...</span>
    </div>

    <div class="actions">
      <button v-if="!isLoggedIn" @click="login" :disabled="isLoading">
        Login
      </button>
      <template v-else>
        <button @click="fetchData" :disabled="isLoading">
          Fetch Data
        </button>
        <button @click="waitForTokenExpiry" :disabled="isLoading">
          Wait for Expiry (4s)
        </button>
        <button @click="testThunderingHerd" :disabled="isLoading" class="primary">
          🔥 Test Thundering Herd
        </button>
        <button @click="logout" class="danger">
          Logout
        </button>
      </template>
    </div>

    <div v-if="error" class="error-box">
      ❌ {{ error.message }}
    </div>

    <div v-if="data" class="data-box">
      <h3>📦 Fetched Data</h3>
      <pre>{{ JSON.stringify(data, null, 2) }}</pre>
    </div>

    <div v-if="concurrentResults.length" class="results-box">
      <h3>🔥 Concurrent Request Results</h3>
      <div class="results-grid">
        <div 
          v-for="result in concurrentResults" 
          :key="result.id"
          :class="['result-item', result.status]"
        >
          #{{ result.id }} {{ result.status === 'success' ? '✓' : '✗' }}
        </div>
      </div>
    </div>

    <div class="logs-box">
      <h3>📋 Activity Log</h3>
      <div class="logs">
        <div v-for="(log, i) in logs" :key="i" class="log-entry">
          {{ log }}
        </div>
        <div v-if="!logs.length" class="empty">No activity yet</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.container {
  max-width: 800px;
  margin: 0 auto;
  padding: 2rem;
  font-family: system-ui, -apple-system, sans-serif;
}

h1 {
  margin-bottom: 0.5rem;
  color: #1a1a1a;
}

.subtitle {
  color: #666;
  margin-bottom: 2rem;
}

.status-bar {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1.5rem;
  padding: 0.75rem 1rem;
  background: #f5f5f5;
  border-radius: 8px;
}

.status {
  font-weight: 600;
}

.status.online {
  color: #22c55e;
}

.status.offline {
  color: #ef4444;
}

.loading {
  color: #3b82f6;
  animation: pulse 1s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
}

button {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 6px;
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  background: #e5e5e5;
  color: #333;
  transition: all 0.2s;
}

button:hover:not(:disabled) {
  background: #d5d5d5;
}

button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

button.primary {
  background: #3b82f6;
  color: white;
}

button.primary:hover:not(:disabled) {
  background: #2563eb;
}

button.danger {
  background: #ef4444;
  color: white;
}

button.danger:hover:not(:disabled) {
  background: #dc2626;
}

.error-box {
  padding: 1rem;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 8px;
  color: #dc2626;
  margin-bottom: 1rem;
}

.data-box, .results-box, .logs-box {
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 1rem;
  margin-bottom: 1rem;
}

.data-box h3, .results-box h3, .logs-box h3 {
  margin: 0 0 0.75rem 0;
  font-size: 1rem;
  color: #374151;
}

pre {
  margin: 0;
  padding: 1rem;
  background: #1f2937;
  color: #f3f4f6;
  border-radius: 6px;
  overflow-x: auto;
  font-size: 0.85rem;
}

.results-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 0.5rem;
}

.result-item {
  padding: 0.5rem;
  text-align: center;
  border-radius: 4px;
  font-weight: 500;
  font-size: 0.85rem;
}

.result-item.success {
  background: #dcfce7;
  color: #166534;
}

.result-item.failed {
  background: #fef2f2;
  color: #dc2626;
}

.logs {
  max-height: 200px;
  overflow-y: auto;
  font-family: monospace;
  font-size: 0.8rem;
}

.log-entry {
  padding: 0.25rem 0;
  border-bottom: 1px solid #e5e7eb;
  color: #4b5563;
}

.empty {
  color: #9ca3af;
  font-style: italic;
}
</style>
