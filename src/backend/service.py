'''
业务处理模块：Python
负责处理来自主程序（Electron）的请求，并通过标准输出返回响应。
'''
import sys
import json
from typing import Any
import random
import time

# 默认挂起超时时间和活跃超时时间
DEFAULT_SUSPEND_TIMEOUT_SECONDS = 300
DEFAULT_ACTIVE_TIMEOUT_SECONDS = 60

class Pet:
    def __init__(self, config: dict[str, Any] | None = None):
        self.state: dict[str, Any] = {}
        self.init_state(config or {})

    def init_state(self, config: dict[str, Any] | None):
        """
        初始化宠物的状态字典，确保所有必需的键都有默认值。

        name: 宠物的名称
        language:设置语言
        lifecycle: 宠物的生命周期状态，默认为 "idle"（active、idle、suspended）
        fps: 动画帧率
        heartbeat: 心跳间隔
        lastInteraction: 上次互动时间戳
        active_timeout_seconds: 活跃超时时间，超过该时间宠物将进入空闲状态
        suspend_timeout_seconds: 挂起超时时间，超过该时间宠物将进入挂起状态
        action: 宠物的当前行为，默认为 "stand"（stand、walk、run、jump、talk、sleep、head-pat、tail-pat）

        参数:
            config: 包含初始配置的字典，如果某些键缺失，将使用默认值。
        返回:
            无
        """
        # 初始化配置字典，确保所有必需的键都有默认值
        # 名称与语言
        self.state["name"] = config.get("name", Pet.generate_name())
        self.state["language"] = config.get("language", "zh-CN")
        
        # 运行状态
        self.state["lifecycle"] = config.get("lifecycle", "idle")
        self.state["fps"] = config.get("fps", 10)
        self.state["heartbeat"] = config.get("heartbeat", 1)
        self.state["lastInteraction"] = config.get("lastInteraction", time.monotonic())
        self.state["active_timeout_seconds"] = config.get("active_timeout_seconds", DEFAULT_ACTIVE_TIMEOUT_SECONDS)
        self.state["suspend_timeout_seconds"] = config.get("suspend_timeout_seconds", DEFAULT_SUSPEND_TIMEOUT_SECONDS)
        
        # 行为状态
        self.state["action"] = config.get("action", "stand")

    def config_state(self, config: dict[str, Any]):
        '''
        更新宠物的状态字典，仅在提供的配置中存在非空值时才修改对应的键。

        参数:
            config: 包含要更新的配置的字典。
        返回:
            无
        '''
        def update_if_present(key: str) -> None:
                value = config.get(key)
        
                if value is not None and value != "":
                    self.state[key] = value
        
        # 名称与语言
        update_if_present("name")
        update_if_present("language")

        # 运行状态
        update_if_present("lifecycle")
        update_if_present("fps")
        update_if_present("heartbeat")
        update_if_present("lastInteraction")
        update_if_present("active_timeout_seconds")
        update_if_present("suspend_timeout_seconds")

        # 行为状态
        update_if_present("action")

    # 宠物电源管理，计算宠物的生命周期状态（活跃、空闲、挂起）
    def calculate_status(self):
        '''
        计算宠物的生命周期状态，包括活跃、空闲和挂起状态，以及对应的帧率和心跳间隔。

        参数:
            无
        返回:
            无
        '''
        # 根据空闲时长计算供 Electron 调度和 React 渲染的完整状态。
        idle_seconds = time.monotonic() - self.state["lastInteraction"]
        suspend_timeout_seconds = self.state.get("suspend_timeout_seconds", DEFAULT_SUSPEND_TIMEOUT_SECONDS)
        active_timeout_seconds = self.state.get("active_timeout_seconds", DEFAULT_ACTIVE_TIMEOUT_SECONDS)
        if idle_seconds >= suspend_timeout_seconds:
            # 挂起生命周期：时既不渲染新动画帧，也不再请求下一次心跳, 宠物进入“睡眠”行为状态
            lifecycle, fps, heartbeat, action = "suspended", 0, None, "sleep"
        elif idle_seconds >= active_timeout_seconds:
            # 空闲生命周期：保留低频心跳，以便在未来可自动转入挂起, 宠物保持“站立”行为状态
            lifecycle, fps, heartbeat, action = "idle", 3, 60, "stand"
        else:
            # 活跃生命周期：时按设计要求以 10 FPS 动画和 1 秒心跳运行，宠物保持“行走”行为状态
            lifecycle, fps, heartbeat, action = "active", 10, 1, "walk"
        self.state["lifecycle"] = lifecycle
        self.state["fps"] = fps
        self.state["heartbeat"] = heartbeat
        self.state["action"] = action

    @staticmethod
    def generate_name() -> str:
        '''
        生成宠物的默认名称。

        返回:
            生成的宠物默认名称。
        '''
        pet_set = ["Luna","Milo","Coco","Leo","Niki","Ollie","Ruby","Max","Daisy","Charlie","Mia","Toby","Lulu","Jack","Molly","Benny","Ivy","Rocky","Zoe","Sam","Hazel","Orion","Winnie","Casper","Freya","Felix","Sage","Nova","Arthur","Piper","Ace","Blaze","Sky","Rio","Storm"]
        return random.choice(pet_set)

# 初始化宠物实例
pet = Pet()

def handleHeartbeat() -> dict[str, Any]:
    """
    处理心跳/状态查询请求：只读取当前状态，不算作一次用户互动。
    """
    pet.calculate_status()
    return {"status": pet.state}

def handleMessage(message: dict[str, Any]) -> dict[str, Any]:
    """
    处理来自 Electron 的消息请求。

    参数:
        message: {"id": "...", "command": "status"|"heartbeat"|"interact"|"configure", ...payload}
    返回:
        包含处理结果的字典
    """
    command = message.get("command")
    # 心跳
    if command in ('status', 'heartbeat'):
        # 两者行为一致：只读计算当前状态，不算用户互动
        return handleHeartbeat()
    # 互动
    elif command == "interact":
        pet.state["lastInteraction"] = time.monotonic()
        # 随机产生互动动作，当前只有 walk 和 stand
        pet.state["action"] = random.choice(["walk", "stand"])
        pet.calculate_status()
        return {"status": pet.state}
    # 配置
    elif command == "configure":
        # payload 字段直接展开在顶层，排除 id/command 后就是配置项
        config = {k: v for k, v in message.items() if k not in ("id", "command")}
        pet.config_state(config)
        pet.calculate_status()
        return {"status": pet.state}
    else:
        raise ValueError(f"Unsupported command: {command}")

'''
通讯协议:pipe 管道， 使用 stdin、stdou、stderr 进行与 Electron 的通信
消息协议: JSON-Lines，每行一个完整的 JSON 请求，响应也为 JSON-Lines。
返回会固定包含 "id" 和 "status" 字段，"status" 为 "ok" 或 "error"。

TODO：
1.能并发处理IO密集型任务（如网络请求、文件读写）
2.能并发处理计算密集型任务（如大规模数据处理、复杂算法计算）
3.封装请求和响应中公共字段的处理逻辑
4.心跳检测是不是应该放入单独的线程或异步任务中

备注：
sys.stdin 底层是阻塞 IO，没消息会处于阻塞状态。
'''
for line in sys.stdin:
    try:
        req = json.loads(line)
        resp_data = handleMessage(req)
        resp_data["id"] = req.get("id", "-1")
        print(json.dumps(resp_data), flush=True)
    except Exception as e:
        try:
            req_id = req.get("id", "-1")
        except Exception:
            req_id = "-1"
        print(json.dumps({"id": req_id, "status": "error", "error": str(e)}), flush=True)