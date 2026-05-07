import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { registerMdiIcons } from './icons.js'
import { i18n } from './i18n/index.js'
import './styles.css'

// Register the specific MDI icons we render so <Icon icon="mdi:...">
// resolves from the bundle at runtime instead of fetching from
// api.iconify.design. Per-icon imports keep the bundle tiny (~3 KB
// for our 17 icons vs. ~750 KB for the full set).
registerMdiIcons()

const app = createApp(App)
app.use(createPinia())
app.use(i18n)
app.mount('#app')
