// 让渲染进程（Pet.tsx / Configure.tsx）里的 window.api 有类型提示
import type { PetAPI } from '../shared/types'

declare global {
  interface Window {
    api: PetAPI
  }
}

export {}