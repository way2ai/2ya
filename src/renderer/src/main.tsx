import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import Pet from './views/Pet'
import Configure from './views/Configure'
// Vite handles CSS imports at runtime; TypeScript may not have a CSS module declaration.
// @ts-ignore
import './styles.css'

// Electron 主进程通过 URL query 的 view 参数区分加载的是宠物窗口还是配置窗口，
// 对应 src/main/index.ts 中 rendererUrl('pet' | 'config') 拼出的 ?view=xxx
function resolveView(): 'pet' | 'config' {
  const params = new URLSearchParams(window.location.search)
  return params.get('view') === 'config' ? 'config' : 'pet'
}

function Root(): JSX.Element {
  return resolveView() === 'config' ? <Configure /> : <Pet />
}

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <Root />
  </StrictMode>
)