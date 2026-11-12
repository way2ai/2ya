// src/renderer/src/views/Pet.tsx
import { useEffect, useRef, useState, type ReactElement } from 'react'
import { ActionEnum, type BackendStatus } from '@shared/types'
// @ts-ignore
import './Pet.css'

const WALK_FRAME_COUNT = 9
const walkFrames = Array.from(
  { length: WALK_FRAME_COUNT },
  (_, i) => `/sprites/frame_${String(i + 1).padStart(2, '0')}.png`
)

export default function Pet(): ReactElement {
  const [status, setStatus] = useState<BackendStatus | null>(null)
  const [frameIndex, setFrameIndex] = useState(0)
  const [showBubble, setShowBubble] = useState(false)
  const [bubbleValue, setBubbleValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  // 拉取初始状态 + 订阅主进程广播
  useEffect(() => {
    let cancelled = false
    window.api.getStatus().then((s) => {
      if (!cancelled) setStatus(s)
    })
    const unsubscribe = window.api.onStatus(setStatus)
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [])

  // 目前只有一套“行走”帧图：action 为 walk 时循环播放，其余状态固定第一帧
  useEffect(() => {
    if (!status || status.action !== ActionEnum.WALK || status.fps <= 0) {
      setFrameIndex(0)
      return
    }
    const timer = setInterval(() => {
      setFrameIndex((i) => (i + 1) % WALK_FRAME_COUNT)
    }, 1000 / status.fps)
    return () => clearInterval(timer)
  }, [status?.action, status?.fps])

  // 弹出气泡时自动聚焦输入框
  useEffect(() => {
    if (showBubble) inputRef.current?.focus()
  }, [showBubble])

  function handleClick(): void {
    void window.api.interact('click')
  }

  function handleContextMenu(e: React.MouseEvent): void {
    e.preventDefault()
    setShowBubble((prev) => !prev)
  }

  function handleBubbleKeyDown(e: React.KeyboardEvent<HTMLInputElement>): void {
    if (e.key === 'Escape') {
      setShowBubble(false)
      setBubbleValue('')
      return
    }
    if (e.key !== 'Enter') return
    if (bubbleValue.trim() === '#config') {
      window.api.openConfig()
    }
    setBubbleValue('')
    setShowBubble(false)
  }

  return (
    <div className="pet-window">
      {showBubble && (
        <div className="pet-bubble">
          <input
            ref={inputRef}
            value={bubbleValue}
            placeholder="输入 #config 打开设置…"
            onChange={(e) => setBubbleValue(e.target.value)}
            onKeyDown={handleBubbleKeyDown}
          />
        </div>
      )}
      <img
        className="pet-sprite"
        src={walkFrames[frameIndex]}
        alt={status?.name ?? 'pet'}
        draggable={false}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
      />
    </div>
  )
}