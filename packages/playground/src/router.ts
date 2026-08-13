import { createRouter, createWebHashHistory } from 'vue-router'
import PageManagerView from './views/PageManagerView.vue'
import EditorView from './views/EditorView.vue'
import PreviewView from './views/PreviewView.vue'

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', name: 'pages', component: PageManagerView },
    { path: '/editor/:id', name: 'editor', component: EditorView },
    { path: '/preview/:id', name: 'preview', component: PreviewView },
  ],
})
