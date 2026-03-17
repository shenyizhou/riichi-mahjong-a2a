# 立直麻将 Agent 对战平台 (Riichi Mahjong A2A)

**Riichi Mahjong A2A** 是一个专为**多智能体 (Multi-Agent) 协作与对抗**设计的立直麻将实验平台。

本项目的核心愿景不是构建一个单机麻将游戏，而是打造一个标准化的**Agent 演练场**。在这里，不同的 AI Agent（无论是基于规则、传统搜索还是深度强化学习）可以通过统一的协议接入，同台竞技，共同探索不完全信息博弈下的最优策略。

## � 项目愿景：连接 Agent 的麻将世界

*   **Agent-to-Agent (A2A)**：主要关注 Agent 之间的交互。无论是人类玩家与 Agent 对战，还是 4 个 Agent 之间的全自动厮杀，平台都提供统一的支持。
*   **标准化接口**：采用业界通用的 **MJAI (Mahjong AI)** 协议，确保任何遵循该协议的 Agent 都能无缝接入。
*   **生态开放**：鼓励开发者提交自己的 Agent，进行算法验证和能力比拼。

## 🌟 核心特性

### 1. 开放的 Agent 接入体系
*   **MJAI 协议原生支持**：服务器实现了标准的 `start_game`, `start_kyoku`, `tsumo`, `dahai` 等事件广播。任何能解析 JSON 并建立 WebSocket 连接的程序都可以成为玩家。
*   **全双工实时通信**：基于 WebSocket 的全双工架构，支持吃、碰、杠、立直等实时中断操作，完美还原真实麻将的交互逻辑。
*   **混合对战模式**：支持 `Human vs Agent`、`Agent vs Agent` 等多种对战组合。

### 2. 完善的对战环境
*   **服务器端逻辑仲裁**：集成了 `syanten`（向听数计算）和 `riichi`（和牌判定）等专业库，确保规则执行的严谨性。
*   **自动托管 Bot**：平台内置了基于向听数优化的基础 Bot。当牌桌人数不足或 Agent 掉线时，服务器会自动接管，保证对局流畅进行。
*   **状态全同步**：不仅同步牌局数据，还实时同步 Agent 的决策状态（如听牌、振听等），方便调试与分析。

### 3. 可视化调试前端
*   **实时观察**：提供现代化的 Web 前端，人类玩家可以实时观看 Agent 的对局过程。
*   **辅助决策**：前端内置向听数计算展示，帮助开发者直观评估 Agent 的手牌质量。
*   **流畅交互**：基于 React + Vite 构建，提供丝滑的出牌动画和交互体验。

## 🛠️ 技术栈

*   **后端 (Server)**: Node.js, Express, WebSocket (ws)
*   **前端 (Client)**: React 18, Vite, Axios
*   **核心算法 (Core)**: 
    *   `syanten`: 高效向听数计算
    *   `riichi`: 役种判定与点数计算
*   **协议 (Protocol)**: MJAI (JSON over WebSocket)

## 🚀 快速开始

### 1. 启动服务器
```bash
cd backend
npm install
npm run dev
# Server running at http://localhost:3001
```

### 2. 启动可视化前端
```bash
cd frontend
npm install
npm run dev
# Frontend running at http://localhost:3000
```

### 3. 接入你的 Agent
你的 Agent 只需连接 `ws://localhost:3001`，并遵循以下 MJAI 消息流即可参与对战：

**连接与认证**
```json
// Client -> Server
{
  "type": "join",
  "token": "YOUR_AGENT_TOKEN",
  "name": "MySuperAgent"
}
```

**接收对局信息**
```json
// Server -> Client (Event: start_kyoku)
{
  "type": "start_kyoku",
  "bakaze": "E",
  "kyoku": 1,
  "tehais": [["1m", "2m", ...], ["?", "?", ...], ...] // 对手手牌自动打码
}
```

**执行操作**
```json
// Client -> Server (Action: discard)
{
  "type": "dahai",
  "pai": "5z",
  "tsumogiri": false
}
```

## 📂 项目结构

```
riichi-mahjong-a2a/
├── backend/                # 游戏服务器 & MJAI 协议处理
│   ├── server.js           # 核心业务逻辑 (连接管理、对局推进)
│   ├── utils/              # 算法模块
│   │   └── mahjong.js      # 麻将规则实现 (Shanten, Win check)
│   └── ...
├── frontend/               # 可视化对战界面
│   ├── src/
│   │   ├── pages/          # 游戏主视图
│   │   └── ...
└── README.md               # 项目说明
```

## 📝 未来规划

- [ ] **Agent 评测系统**：建立天梯积分，定期举办 Agent 联赛。
- [ ] **牌谱回放 (Replay)**：支持 Tenhou/Majsoul 格式牌谱导出，方便复盘分析。
- [ ] **更复杂的协议支持**：完善副露（Call）逻辑，支持抢杠和、包牌等高级规则。
- [ ] **多语言 SDK**：提供 Python/Rust/Go 的 Agent 接入 SDK。

## 📄 许可证

ISC License
