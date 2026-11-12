// 主程序：Electron
// 负责窗口管理、IPC 路由和 Python 业务进程调度。
import { app, BrowserWindow, ipcMain, screen } from 'electron';
import { ChildProcessWithoutNullStreams, spawn } from 'node:child_process'
import path from 'node:path'
import readline from 'node:readline'

import type { BackendStatus } from '../shared/types';
import { LanguageEnum, PetStateEnum, ActionEnum } from '../shared/types';

// 宠物窗口
let petWindow: BrowserWindow | undefined;
// 配置窗口
let configWindow: BrowserWindow | undefined;
// 后端子进程
let backend: ChildProcessWithoutNullStreams | undefined;
// 自增请求 ID
let requestId: number = 0;

const pending: Map<string, (status: BackendStatus) => void> = new Map();
let currentStatus: BackendStatus = {
    name: "Pet",
    language: LanguageEnum.ZH_CN,
    lifecycle: PetStateEnum.ACTIVE,
    fps: 10,
    heartbeat: 1,
    lastInteraction: Date.now(),
    active_timeout_seconds: 60,
    suspend_timeout_seconds: 300,
    action: ActionEnum.STAND,
}

let heartbeatTimer: NodeJS.Timeout | undefined;

/**
 * start backend child process and set event listeners
 * 
 * 整个流程：
Python print + flush → py.stdout（Readable流，分片chunk）
→ readline 内部缓冲、拼包、识别换行
→ 拼成完整一行后触发 line 事件
→ 解析JSON，拿id，去pending Map取出 {resolve, reject, timer}
→ clearTimeout 取消超时
→ resolve / reject 唤醒外面await的Promise
 * 
 * @returns void
 * 
 * PLAN：
 * 1. 处理背压，引入drain机制
 * 2. 引入 stderr 监听事件
 */
function startBackend() {
    const projectPath = app.getAppPath();
    const script = path.join(projectPath, 'src', 'backend', 'service.py');
    const process = spawn('uv', ['run', '--project', projectPath, 'python', '-u', script]);
    backend = process;

    // 行解析器（自动处理分片） + 事件监听（line 事件）
    readline.createInterface({input: process.stdout}).on('line', (line) => {
        const message = JSON.parse(line) as { id: string; status: BackendStatus, error?: string };
        const resolve = pending.get(message.id);
        if (resolve) {
            pending.delete(message.id);
            resolve(message.status);
        }
    });

    // 事件监听（子进程退出事件）
    process.once('exit', () => {
        backend = undefined;
    });
}

/**
 * 发起后端请求
 * 
 * 执行顺序：
// 1. 调用callPython，new Promise，executor同步执行
// 2. 创建定时器，把 resolve/reject/timer 存入pending Map
// 3. 发送消息给Python，executor执行完毕，Promise进入pending
// 4. JS主线程继续跑别的（接收stdout、UI事件）
// 5. Python返回响应 → readline line事件触发 → 取出item → resolve() → Promise fulfilled
 * 
 * @param command 后端命令
 * @param playload 请求负载
 * @returns 返回一个 Promise，解析为后端状态
 * 
 * PLAN：
 * 1. 处理背压，引入drain机制
 */
function requestBackend(command: string, playload: Record<string, unknown> = {}): Promise<BackendStatus> {
    if (!backend) {
        return Promise.reject(new Error("Backend not started"));
    }

    const id = String(++requestId);
    backend.stdin?.write(`${JSON.stringify({id, command, ...playload})}\n`);
    return new Promise((resolve) => pending.set(id, resolve));
}

// 后端广播状态给前端窗口
function broadcast(status: BackendStatus) {
    currentStatus = status;
    for (const window of [petWindow, configWindow]) {
        if (window && !window.isDestroyed()) {
            window?.webContents.send('pet:status', status);
        }
    }
}

// 心跳检测
async function heartbeat(): Promise<void> {
    const status = await requestBackend('heartbeat');
    broadcast(status);
    scheduleHeartbeat(status);
}

// 下一次心跳计划
function scheduleHeartbeat(status: BackendStatus): void{
    if (heartbeatTimer) clearTimeout(heartbeatTimer);
    if (status.heartbeat === null) return;
    heartbeatTimer = setTimeout(() => void heartbeat(), status.heartbeat * 1000);
}

// 开发模式加载 Vite，打包模式加载本地构建产物；URL 参数决定 React 视图
// 没懂为什么要根据 app.isPackaged 来区分 URL，这里的app指的是什么？
function rendererUrl(view: 'pet' | 'config'): string {
    const query = `?view=${view}`;
    return app.isPackaged
        ? `file://${path.join(__dirname, '../renderer/index.html')}${query}`
        : `http://localhost:5173/${query}`;
}

// 创建应用窗口，包括宠物窗口和配置窗口
function createWindow(): void {
    const {workArea} = screen.getPrimaryDisplay();
    petWindow = new BrowserWindow({
        // 大小、位置
        width: 220,
        height: 220,
        x: workArea.x + workArea.width - 220,
        y: workArea.y + workArea.height - 270,
        // 透明、无框、始终在最前面、不可调整大小、无阴影
        transparent: true,
        frame: false,
        alwaysOnTop: true,
        resizable: false,
        hasShadow: false,
        // 通过预加载层暴露白名单 API，渲染进程不直接拥有 Node 权限(没理解)
        webPreferences: { preload: path.join(__dirname, '../preload/index.js'), contextIsolation: true, nodeIntegration: false }
    });
    petWindow.on('closed', () => { petWindow = undefined; });
    // 没理解
    petWindow.setIgnoreMouseEvents(false);

    // 没理解
    void petWindow.loadURL(rendererUrl('pet'));

    configWindow = new BrowserWindow({
        width: 520,
        height: 680,
        title: '2ya 配置',
        show: false, // 默认不显示，等用户输入 #config 再弹出
        webPreferences: { preload: path.join(__dirname, '../preload/index.js'), contextIsolation: true, nodeIntegration: false }
    });
    configWindow.on('closed', () => { configWindow = undefined; });
    void configWindow.loadURL(rendererUrl('config'));
}

// 应用准备就绪时的处理逻辑，包括启动后端、注册 IPC 事件、创建窗口和初始化状态
app.whenReady().then(async () => {
    // 启动后端进程
    startBackend();
    
    // 处理渲染进程请求当前宠物状态、交互和配置的 IPC 事件
    ipcMain.handle('pet:get-status', () => currentStatus);
    ipcMain.handle('pet:interact', async (_event, action: string) => {
        const status = await requestBackend('interact', { action });
        broadcast(status);
        scheduleHeartbeat(status);
        return status;
    });
    ipcMain.handle('pet:configure', async (_event, setting:Record<string, unknown>) => {
        const status = await requestBackend('configure', setting);
        broadcast(status);
        scheduleHeartbeat(status);
        return status;
    });
    ipcMain.on('pet:open-config', () => {
        configWindow?.show()
        configWindow?.focus()
    });

    // 创建应用窗口并初始化状态
    createWindow();
    const initial = await requestBackend('status');
    broadcast(initial);
    scheduleHeartbeat(initial);
});

// 应用退出处理
app.on('window-all-closed', () => app.quit());
app.on('before-quit', () => {
    if (heartbeatTimer) clearTimeout(heartbeatTimer);
    backend?.kill();
});