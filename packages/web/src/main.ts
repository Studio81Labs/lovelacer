import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { addCollection } from '@iconify/vue'
import mdiIcons from '@iconify-json/mdi/icons.json'
import App from './App.vue'
import './styles.css'

// Register the MDI icon set up front so <Icon icon="mdi:..."> resolves
// from the bundled JSON at runtime instead of fetching from
// api.iconify.design (which would fail in offline HA installs).
addCollection(mdiIcons)

const app = createApp(App)
app.use(createPinia())
app.mount('#app')
