// 前端（main/preload/renderer）与后端 Python 共用的状态类型
// 字段需与 src/backend/service.py 中 Pet.state 保持一致

enum PetStateEnum {
    ACTIVE = "active",
    IDLE = "idle",
    SUSPENDED = "suspended"
}

enum LanguageEnum {
    ZH_CN = "zh-CN",
    EN_US = "en-US",
    JA_JP = "ja-JP",
    KO_KR = "ko-KR"
}

enum ActionEnum {
    STAND = "stand",
    SIT = "sit",
    LIE = "lie",
    WALK = "walk",
    RUN = "run"
}

type BackendStatus = {
    name: string;
    language: LanguageEnum;
    lifecycle: PetStateEnum;
    fps: number;
    heartbeat: number | null;
    lastInteraction: number;
    active_timeout_seconds: number;
    suspend_timeout_seconds: number;
    action: ActionEnum;
}

export type { BackendStatus };
export { LanguageEnum, PetStateEnum, ActionEnum };

// 渲染进程通过 window.api 调用的能力集合
export interface PetAPI {
  getStatus(): Promise<BackendStatus>
  interact(action?: string): Promise<BackendStatus>
  configure(settings: Partial<BackendStatus>): Promise<BackendStatus>
  onStatus(callback: (status: BackendStatus) => void): () => void
  openConfig(): void
}