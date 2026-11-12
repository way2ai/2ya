// 预加载脚本：在隔离上下文中把白名单 API 暴露给渲染进程（window.api）
// 渲染进程本身不具备 Node/Electron 权限，只能通过这里暴露的函数间接通信
import { contextBridge, ipcRenderer } from 'electron'
import type { BackendStatus, PetAPI } from '../shared/types'

const api: PetAPI = {
  // 获取当前缓存的宠物状态（只读，不触发互动计时）
  getStatus: () => ipcRenderer.invoke('pet:get-status'),

  // 触发一次互动（左键点击宠物），action 为可选的互动类型标识
  interact: (action) => ipcRenderer.invoke('pet:interact', action),

  // 提交配置表单，settings 为部分状态字段（如 name、language）
  configure: (settings) => ipcRenderer.invoke('pet:configure', settings),

  // 订阅主进程广播的状态更新；返回取消订阅函数，供 React useEffect 清理时调用
  onStatus: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, status: BackendStatus) => callback(status)
    ipcRenderer.on('pet:status', listener)
    return () => ipcRenderer.removeListener('pet:status', listener)
  },

  // 通知主进程显示/聚焦配置窗口（对应 Pet.tsx 中 "#config" 快捷指令）
  openConfig: () => ipcRenderer.send('pet:open-config')
}

// contextIsolation 为 true（main/index.ts 里已这样配置）时必须通过 contextBridge 暴露，
// 不能直接把对象挂到 window 上，否则渲染进程拿不到
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // 兜底分支：如果以后关闭了 contextIsolation，直接挂载（正常配置不会走到这里）
  // @ts-expect-error 非隔离环境下允许直接挂到 window
  window.api = api
}