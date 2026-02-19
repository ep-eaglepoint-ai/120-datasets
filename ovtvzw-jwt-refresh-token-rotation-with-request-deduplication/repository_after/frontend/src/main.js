import { createApp } from 'vue'
import App from './App.vue'
import { setBaseUrl } from './composables/useAuthFetch'

setBaseUrl('http://localhost:3000');

createApp(App).mount('#app')
