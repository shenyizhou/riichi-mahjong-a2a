const express = require('express');
const cors = require('cors');
const path = require('path');
const { WebSocketServer } = require('ws');
const http = require('http');
const { calculateShanten, checkWin, getMjaiType, getBestDiscard } = require('./utils/mahjong');

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

function initGame(table) {
  const tiles = [];
  const suits = ['man', 'pin', 'sou'];
  const winds = ['东', '南', '西', '北'];
  const dragons = ['白', '发', '中'];

  // Suits 1-9
  suits.forEach(suit => {
    for (let i = 1; i <= 9; i++) {
      for (let j = 0; j < 4; j++) {
        tiles.push({ suit, rank: i.toString(), value: i });
      }
    }
  });

  // Winds
  winds.forEach((wind, index) => {
    for (let j = 0; j < 4; j++) {
      tiles.push({ suit: 'wind', rank: wind, value: 10 + index });
    }
  });

  // Dragons
  dragons.forEach((dragon, index) => {
    for (let j = 0; j < 4; j++) {
      tiles.push({ suit: 'dragon', rank: dragon, value: 20 + index });
    }
  });

  // Shuffle
  for (let i = tiles.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
  }

  table.wall = tiles;
  table.dora_indicators = [table.wall.pop()];
  table.current_player = 0;
  table.discards = [];
  
  // Deal 13 tiles to each player
  table.players.forEach(player => {
    player.hand = [];
    for (let i = 0; i < 13; i++) {
      player.hand.push(table.wall.pop());
    }
    player.score = 25000;
    // player.discards is already used in state response as a count, let's keep it compatible or update it
    // In state response: discards: [{ player: 0, tile: ... }] (global)
    // In players list: discards: 10 (count)
  });
  
  table.status = 'playing';

  // MJAI Protocol: Start Game
  table.players.forEach(player => {
    if (player.ws) {
      // 1. start_game
      player.ws.send(JSON.stringify({
        type: 'start_game',
        id: player.seat,
        names: table.players.map(p => p.name)
      }));

      // 2. start_kyoku
      const tehais = table.players.map(p => p.hand.map(getMjaiType));
      // Mask other players' hands
      const maskedTehais = tehais.map((hand, idx) => 
        idx === player.seat ? hand : hand.map(() => '?')
      );

      player.ws.send(JSON.stringify({
        type: 'start_kyoku',
        bakaze: 'E',
        kyoku: 1,
        honba: 0,
        kyotaku: 0,
        oya: 0,
        dora_marker: getMjaiType(table.dora_indicators[0]),
        tehais: maskedTehais
      }));

      // 3. First tsumo (if applicable)
      if (table.current_player === player.seat) {
        // In real game, dealer draws first tile or has 14 tiles?
        // Let's assume dealer has 14 tiles initially or draws one now.
        // Our init logic gave 13 tiles. So draw one.
        const drawnTile = table.wall.pop();
        player.hand.push(drawnTile);
        player.ws.send(JSON.stringify({
          type: 'tsumo',
          actor: player.seat,
          pai: getMjaiType(drawnTile)
        }));
      }
    }
  });
}

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
    players: [],
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
    seat: table.players.length,
    hand: [],
    score: 25000,
    discards: 0
  };
  table.players.push(player);
  
  if (table.players.length === 4) {
    initGame(table);
  } else {
    table.status = 'waiting';
  }

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
  const shanten = calculateShanten(player.hand);
  
  res.json({
    success: true,
    data: {
      status: table.status,
      current_player: table.current_player || 0,
      my_seat: player.seat,
      my_hand: player.hand || [],
      my_shanten: shanten,
      discards: table.discards || [],
      dora_indicators: table.dora_indicators || [],
      riichi_bets: [0, 0, 0, 0], // Simplified
      players: table.players.map(p => ({
        seat: p.seat,
        name: p.name,
        score: p.score || 25000,
        discards: p.discards || 0
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
  const handIndex = player.hand.findIndex(t => t.suit === tile.suit && t.value === tile.value);
  if (handIndex > -1) {
    player.hand.splice(handIndex, 1);
  }
  table.discards.push({ player: player.seat, tile });
  player.discards++; // Count
  
  // Move to next player
  table.current_player = (table.current_player + 1) % 4;
  
  // MJAI: Broadcast dahai
  table.players.forEach(p => {
    if (p.ws) {
      p.ws.send(JSON.stringify({
        type: 'dahai',
        actor: player.seat,
        pai: getMjaiType(tile),
        tsumogiri: false // Simplified
      }));
    }
  });

  // Check if any AI wants to call (Pon/Chi/Ron)
  // For now, let's just proceed to next turn after a small delay to simulate thinking/network
  setTimeout(() => {
    processNextTurn(table);
  }, 1000);
  
  res.json({
    success: true,
    message: '出牌成功',
    data: {
      next_player: (table.current_player + 1) % 4
    }
  });
});

function processNextTurn(table) {
  // Move to next player
  table.current_player = (table.current_player + 1) % 4;
  const currentPlayer = table.players[table.current_player];
  
  if (currentPlayer.ws) {
      // It's a connected agent/player.
      if (table.wall.length > 0) {
          const drawnTile = table.wall.pop();
          currentPlayer.hand.push(drawnTile);
          
          currentPlayer.ws.send(JSON.stringify({
              type: 'tsumo',
              actor: currentPlayer.seat,
              pai: getMjaiType(drawnTile)
          }));
          
          // Broadcast tsumo to others (masked)
          table.players.forEach(p => {
              if (p.seat !== currentPlayer.seat && p.ws) {
                  p.ws.send(JSON.stringify({
                      type: 'tsumo',
                      actor: currentPlayer.seat,
                      pai: '?'
                  }));
              }
          });
      } else {
          table.status = 'finished';
          broadcastGameEnd(table);
      }
  } else {
      // Server-side Bot Logic
      if (table.wall.length > 0) {
          const drawnTile = table.wall.pop();
          currentPlayer.hand.push(drawnTile);
          
          // Broadcast tsumo (masked)
          table.players.forEach(p => {
              if (p.ws) {
                  p.ws.send(JSON.stringify({
                      type: 'tsumo',
                      actor: currentPlayer.seat,
                      pai: '?'
                  }));
              }
          });
          
          // Bot Decision: Minimize Shanten
          // Simulate "thinking" time
          setTimeout(() => {
              const discardIndex = getBestDiscard(currentPlayer.hand);
              let discardTile;
              if (discardIndex >= 0 && discardIndex < currentPlayer.hand.length) {
                discardTile = currentPlayer.hand.splice(discardIndex, 1)[0];
              } else {
                discardTile = currentPlayer.hand.pop();
              }
              
              table.discards.push({ player: currentPlayer.seat, tile: discardTile });
              currentPlayer.discards++;
              
              // Broadcast dahai
              table.players.forEach(p => {
                  if (p.ws) {
                      p.ws.send(JSON.stringify({
                          type: 'dahai',
                          actor: currentPlayer.seat,
                          pai: getMjaiType(discardTile),
                          tsumogiri: discardIndex === currentPlayer.hand.length // if it was the drawn tile
                      }));
                  }
              });
              
              // Next turn
              processNextTurn(table);
          }, 1000);
      } else {
          table.status = 'finished';
          broadcastGameEnd(table);
      }
  }
}

function broadcastGameEnd(table) {
    table.players.forEach(p => {
        if (p.ws) {
            p.ws.send(JSON.stringify({ type: 'end_game' }));
        }
    });
}

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
        // 将 WS 连接与玩家绑定
        const token = message.token;
        const user = users.find(u => u.api_key === token);
        if (user) {
            // Find if user is in any table
            const table = tables.find(t => t.players.some(p => p.id === user.id));
            if (table) {
                const player = table.players.find(p => p.id === user.id);
                player.ws = ws;
                console.log(`Player ${user.name} reconnected to table ${table.table_id}`);
            }
        }
        break;
      case 'dahai':
        // MJAI: { type: "dahai", actor: 0, pai: "6p", tsumogiri: false }
        // Handle discard via WS if implementing full MJAI here
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
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
});
