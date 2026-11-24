import { type ReactElement } from 'react';
import Pet from './views/Pet';
import Configure from './views/Configure';

// Electron 主进程通过 URL query 的 view 参数区分加载的是宠物窗口还是配置窗口
function resolveView(): 'pet' | 'config' {
  const params = new URLSearchParams(window.location.search);
  return params.get('view') === 'config' ? 'config' : 'pet';
}

export default function App(): ReactElement {
  return resolveView() === 'config' ? <Configure /> : <Pet />;
}
