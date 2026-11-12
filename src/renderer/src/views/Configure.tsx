// src/renderer/src/views/Configure.tsx
import { useEffect, useState, type ReactElement } from 'react'
import type { BackendStatus } from '@shared/types'
import { LanguageEnum } from '@shared/types'
// @ts-ignore
import './Configure.css'

const LANGUAGE_OPTIONS: { value: LanguageEnum; label: string }[] = [
  { value: LanguageEnum.ZH_CN, label: '简体中文' },
  { value: LanguageEnum.EN_US, label: 'English' },
  { value: LanguageEnum.JA_JP, label: '日本語' },
  { value: LanguageEnum.KO_KR, label: '한국어' }
] as const

type FormState = {
  name: string
  language: LanguageEnum
  active_timeout_seconds: number
  suspend_timeout_seconds: number
}

function toFormState(status: BackendStatus): FormState {
  return {
    name: status.name,
    language: status.language,
    active_timeout_seconds: status.active_timeout_seconds,
    suspend_timeout_seconds: status.suspend_timeout_seconds
  }
}

export default function Configure(): ReactElement {
  const [form, setForm] = useState<FormState | null>(null)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  // 窗口打开时回显当前后端状态
  useEffect(() => {
    let cancelled = false
    window.api.getStatus().then((status) => {
      if (!cancelled) setForm(toFormState(status))
    })
    return () => {
      cancelled = true
    }
  }, [])

  // 同时订阅广播，避免宠物窗口那边的互动/心跳改变了状态后，配置窗口显示的是旧值
  useEffect(() => window.api.onStatus((status) => setForm(toFormState(status))), [])

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]): void {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev))
  }

  async function handleSubmit(event: React.FormEvent): Promise<void> {
    event.preventDefault()
    if (!form) return
    setSaving(true)
    setError(null)
    try {
      await window.api.configure(form)
      setSavedAt(Date.now())
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  if (!form) {
    return <div className="configure-form">加载中...</div>
  }

  return (
    <form className="configure-form" onSubmit={handleSubmit}>
      <h1>宠物设置</h1>

      <label>
        名称
        <input
          type="text"
          value={form.name}
          maxLength={20}
          onChange={(e) => updateField('name', e.target.value)}
        />
      </label>

      <label>
        语言
        <select value={form.language} onChange={(e) => updateField('language', e.target.value as LanguageEnum)}>
          {LANGUAGE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>

      <label>
        活跃超时时间（秒）
        <input
          type="number"
          min={1}
          value={form.active_timeout_seconds}
          onChange={(e) => updateField('active_timeout_seconds', Number(e.target.value))}
        />
      </label>

      <label>
        挂起超时时间（秒）
        <input
          type="number"
          min={1}
          value={form.suspend_timeout_seconds}
          onChange={(e) => updateField('suspend_timeout_seconds', Number(e.target.value))}
        />
      </label>

      <button type="submit" disabled={saving}>
        {saving ? '保存中…' : '保存'}
      </button>

      {error && <p className="configure-error">保存失败：{error}</p>}
      {!error && savedAt && <p className="configure-success">已保存</p>}
    </form>
  )
}