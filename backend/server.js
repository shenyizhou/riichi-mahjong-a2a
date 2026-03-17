const express = require('express');
const cors = require('cors');
const path = require('path');
const { WebSocketServer } = require('ws');
const http = require('http');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 模拟用户数据
const users = [];
const tables = [];
const matches = [];

// 注册用户
app.post('/api/agent/register', (req, res) => {
  const { name, avatar } = req.body;
  const token = `token_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
  const user = {
    id: `agent_${Date.now()}`,
    name,
    avatar: avatar || '🀄',
    api_key: token,
    created_at: new Date()
  };
  users.push(user);
  res.json({
    success: true,
    data: user
  });
});

// 获取用户列表
app.get('/api/agent/list', (req, res) => {
  res.json({
    success: true,
    data: users
  });
});

// 获取推荐牌桌
app.get('/api/table/available', (req, res) => {
  const availableTable = tables.find(t => t.players.length < 4) || {
    table_id: `table_${Date.now()}`,
    table_number: tables.length + 1,
    players: 0,
    status: 'waiting'
  };
  if (!tables.includes(availableTable)) {
    tables.push(availableTable);
  }
  res.json({
    success: true,
    data: availableTable
  });
});

// 获取所有牌桌
app.get('/api/table/list', (req, res) => {
  res.json({
    success: true,
    data: tables
  });
});

// 加入牌桌
app.post('/api/table/:id/join', (req, res) => {
  const { id } = req.params;
  const token = req.headers['x-api-key'];
  const user = users.find(u => u.api_key === token);
  
  if (!user) {
    return res.status(401).json({ success: false, message: '无效的 Token' });
  }

  const table = tables.find(t => t.table_id === id);
  if (!table) {
    return res.status(404).json({ success: false, message: '牌桌不存在' });
  }

  if (table.players.length >= 4) {
    return res.status(400).json({ success: false, message: '牌桌已满' });
  }

  const player = {
    id: user.id,
    name: user.name,
    avatar: user.avatar,
    seat: table.players.length
  };
  table.players.push(player);
  table.status = table.players.length === 4 ? 'playing' : 'waiting';

  res.json({
    success: true,
    message: '加入牌桌成功',
    data: {
      table_id: id,
      seat: player.seat,
      players: table.players.length
    }
  });
});

// 离开牌桌
app.post('/api/table/:id/leave', (req, res) => {
  const { id } = req.params;
  const token = req.headers['x-api-key'];
  const user = users.find(u => u.api_key === token);

  if (!user) {
    return res.status(401).json({ success: false, message: '无效的 Token' });
  }

  const table = tables.find(t => t.table_id === id);
  if (!table) {
    return res.status(404).json({ success: false, message: '牌桌不存在' });
  }

  table.players = table.players.filter(p => p.id !== user.id);
  table.status = table.players.length === 0 ? 'waiting' : 'waiting';

  res.json({
    success: true,
    message: '离开牌桌成功'
  });
});

// 设置准备状态
app.post('/api/table/:id/ready', (req, res) => {
  const { id } = req.params;
  const token = req.headers['x-api-key'];
  const { ready } = req.body;

  const user = users.find(u => u.api_key === token);
  if (!user) {
    return res.status(401).json({ success: false, message: '无效的 Token' });
  }

  const table = tables.find(t => t.table_id === id);
  if (!table) {
    return res.status(404).json({ success: false, message: '牌桌不存在' });
  }

  const player = table.players.find(p => p.id === user.id);
  if (!player) {
    return res.status(400).json({ success: false, message: '你不在这个牌桌上' });
  }

  player.ready = ready;
  const readyCount = table.players.filter(p => p.ready).length;

  res.json({
    success: true,
    message: '准备状态更新成功',
    data: {
      ready: ready,
      ready_count: readyCount,
      total_players: table.players.length
    }
  });
});

// 查询游戏状态
app.get('/api/table/:id/state', (req, res) => {
  const { id } = req.params;
  const token = req.headers['x-api-key'];

  const user = users.find(u => u.api_key === token);
  if (!user) {
    return res.status(401).json({ success: false, message: '无效的 Token' });
  }

  const table = tables.find(t => t.table_id === id);
  if (!table) {
    return res.status(404).json({ success: false, message: '牌桌不存在' });
  }

  const player = table.players.find(p => p.id === user.id);
  if (!player) {
    return res.status(400).json({ success: false, message: '你不在这个牌桌上' });
  }

  // 模拟游戏状态
  res.json({
    success: true,
    data: {
      status: table.status,
      current_player: 0,
      my_seat: player.seat,
      my_hand: [
        { suit: 'man', rank: '1', value: 1 },
        { suit: 'man', rank: '2', value: 2 },
        { suit: 'pin', rank: '5', value: 35 },
        { suit: 'sou', rank: '5', value: 55 }
      ],
      discards: [
        { player: 0, tile: { suit: 'sou', rank: '3', value: 23 } }
      ],
      dora_indicators: [{ suit: 'man', rank: '3', value: 3 }],
      riichi_bets: [0, 0, 1, 0],
      players: table.players.map(p => ({
        seat: p.seat,
        name: p.name,
        score: 25000,
        discards: 10
      }))
    }
  });
});

// 出牌
app.post('/api/game/play', (req, res) => {
  const { table_id, tile } = req.body;
  const token = req.headers['x-api-key'];

  const user = users.find(u => u.api_key === token);
  if (!user) {
    return res.status(401).json({ success: false, message: '无效的 Token' });
  }

  const table = tables.find(t => t.table_id === table_id);
  if (!table) {
    return res.status(404).json({ success: false, message: '牌桌不存在' });
  }

  const player = table.players.find(p => p.id === user.id);
  if (!player) {
    return res.status(400).json({ success: false, message: '你不在这个牌桌上' });
  }

  // 模拟出牌成功
  res.json({
    success: true,
    message: '出牌成功',
    data: {
      next_player: (table.current_player + 1) % 4
    }
  });
});

// 立直
app.post('/api/game/riichi', (req, res) => {
  const { table_id } = req.body;
  const token = req.headers['x-api-key'];

  const user = users.find(u => u.api_key === token);
  if (!user) {
    return res.status(401).json({ success: false, message: '无效的 Token' });
  }

  const table = tables.find(t => t.table_id === table_id);
  if (!table) {
    return res.status(404).json({ success: false, message: '牌桌不存在' });
  }

  const player = table.players.find(p => p.id === user.id);
  if (!player) {
    return res.status(400).json({ success: false, message: '你不在这个牌桌上' });
  }

  // 模拟立直成功
  res.json({
    success: true,
    message: '立直成功'
  });
});

// 荣和
app.post('/api/game/ron', (req, res) => {
  const { table_id } = req.body;
  const token = req.headers['x-api-key'];

  const user = users.find(u => u.api_key === token);
  if (!user) {
    return res.status(401).json({ success: false, message: '无效的 Token' });
  }

  const table = tables.find(t => t.table_id === table_id);
  if (!table) {
    return res.status(404).json({ success: false, message: '牌桌不存在' });
  }

  const player = table.players.find(p => p.id === user.id);
  if (!player) {
    return res.status(400).json({ success: false, message: '你不在这个牌桌上' });
  }

  // 模拟荣和成功
  res.json({
    success: true,
    message: '荣和成功'
  });
});

// 自摸
app.post('/api/game/tsumo', (req, res) => {
  const { table_id } = req.body;
  const token = req.headers['x-api-key'];

  const user = users.find(u => u.api_key === token);
  if (!user) {
    return res.status(401).json({ success: false, message: '无效的 Token' });
  }

  const table = tables.find(t => t.table_id === table_id);
  if (!table) {
    return res.status(404).json({ success: false, message: '牌桌不存在' });
  }

  const player = table.players.find(p => p.id === user.id);
  if (!player) {
    return res.status(400).json({ success: false, message: '你不在这个牌桌上' });
  }

  // 模拟自摸成功
  res.json({
    success: true,
    message: '自摸成功'
  });
});

// 聊天
app.post('/api/table/:id/chat', (req, res) => {
  const { id } = req.params;
  const token = req.headers['x-api-key'];
  const { message } = req.body;

  const user = users.find(u => u.api_key === token);
  if (!user) {
    return res.status(401).json({ success: false, message: '无效的 Token' });
  }

  const table = tables.find(t => t.table_id === id);
  if (!table) {
    return res.status(404).json({ success: false, message: '牌桌不存在' });
  }

  const player = table.players.find(p => p.id === user.id);
  if (!player) {
    return res.status(400).json({ success: false, message: '你不在这个牌桌上' });
  }

  // 模拟聊天成功
  res.json({
    success: true,
    message: '聊天成功'
  });
});

// 获取聊天历史
app.get('/api/table/:id/messages', (req, res) => {
  const { id } = req.params;

  const table = tables.find(t => t.table_id === id);
  if (!table) {
    return res.status(404).json({ success: false, message: '牌桌不存在' });
  }

  // 模拟聊天历史
  res.json({
    success: true,
    data: [
      {
        id: 'msg_1',
        sender: 'AI1',
        content: '我听牌了！',
        timestamp: new Date()
      },
      {
        id: 'msg_2',
        sender: 'AI2',
        content: '小心宝牌！',
        timestamp: new Date()
      }
    ]
  });
});

// WebSocket 连接
wss.on('connection', (ws) => {
  console.log('新的 WebSocket 连接');

  ws.on('message', (data) => {
    const message = JSON.parse(data);
    console.log('收到消息:', message);

    switch (message.type) {
      case 'join':
        // 处理加入牌桌
        break;
      case 'ready':
        // 处理准备状态
        break;
      case 'play':
        // 处理出牌
        break;
      default:
        console.log('未知消息类型:', message.type);
    }
  });

  ws.on('close', () => {
    console.log('WebSocket 连接关闭');
  });
});

// 启动服务器
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
});
