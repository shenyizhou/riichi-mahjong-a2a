import { useState, useEffect } from 'react';
import axios from 'axios';

function Game({ user }) {
  const [gameState, setGameState] = useState(null);
  const [tableId, setTableId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [chatMessages, setChatMessages] = useState([]);

  useEffect(() => {
    fetchGameState();
    const interval = setInterval(fetchGameState, 3000); // Poll every 3 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchGameState = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/table/available');
      const table = response.data.data;
      setTableId(table.table_id);
      
      // 先加入牌桌，忽略可能已经加入的错误
      try {
        await axios.post(`/api/table/${table.table_id}/join`);
      } catch (e) {
        // 如果已经加入或其他错误，这里可以暂时忽略，继续获取状态
      }
      
      const stateResponse = await axios.get(`/api/table/${table.table_id}/state`);
      setGameState(stateResponse.data.data);
      
      // 获取聊天记录
      fetchChatMessages(table.table_id);
    } catch (error) {
      setError(error.response?.data?.message || '获取游戏状态失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchChatMessages = async (tid) => {
    const id = tid || tableId;
    if (!id) return;

    try {
      const response = await axios.get(`/api/table/${id}/messages`);
      setChatMessages(response.data.data);
    } catch (error) {
      console.error('获取聊天历史失败:', error);
    }
  };

  const handleSendMessage = async () => {
    if (!message.trim() || !tableId) return;

    try {
      const response = await axios.post(`/api/table/${tableId}/chat`, {
        message: message.trim()
      });
      
      if (response.data.success) {
        setMessage('');
        fetchChatMessages();
      } else {
        setError('发送消息失败');
      }
    } catch (error) {
      setError(error.response?.data?.message || '发送消息失败');
    }
  };

  const handlePlay = async (tile) => {
    if (!tableId) return;

    try {
      const response = await axios.post('/api/game/play', {
        table_id: tableId,
        tile
      });
      
      if (response.data.success) {
        fetchGameState();
      } else {
        setError('出牌失败');
      }
    } catch (error) {
      setError(error.response?.data?.message || '出牌失败');
    }
  };

  const handleRiichi = async () => {
    if (!tableId) return;

    try {
      const response = await axios.post('/api/game/riichi', {
        table_id: tableId
      });
      
      if (response.data.success) {
        fetchGameState();
      } else {
        setError('立直失败');
      }
    } catch (error) {
      setError(error.response?.data?.message || '立直失败');
    }
  };

  if (loading) {
    return (
      <div className="game-container">
        <div className="card">
          <h2 className="card-title">加载中...</h2>
          <p className="card-content text-muted">
            正在获取游戏信息...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="game-container">
      <div className="card">
        <h2 className="card-title">立直麻将 A2A 游戏</h2>
        <p className="card-content text-muted">
          桌号：{tableId} | 您的座位：{gameState.my_seat} | 积分：{gameState.players[gameState.my_seat].score}
        </p>
        <p className="card-content text-muted">
          向听数：{gameState.my_shanten !== undefined ? (gameState.my_shanten <= 0 ? (gameState.my_shanten === -1 ? '胡牌' : '听牌') : gameState.my_shanten + ' 向听') : '计算中...'}
        </p>
        
        <div className="game-info">
          <div className="card">
            <h3 className="card-title">宝牌指示牌</h3>
            <div className="dora-indicators">
              {gameState.dora_indicators.map((dora, index) => (
                <div key={index} className="dora-tile">
                  {dora.suit === 'man' && '万'}
                  {dora.suit === 'pin' && '筒'}
                  {dora.suit === 'sou' && '索'}
                  {dora.suit === 'wind' && '风'}
                  {dora.suit === 'dragon' && '龙'}
                  {dora.rank}
                </div>
              ))}
            </div>
          </div>
          
          <div className="card">
            <h3 className="card-title">其他玩家信息</h3>
            <div className="players-info">
              {gameState.players.map((player, index) => (
                index !== gameState.my_seat && (
                  <div key={index} className="player-info">
                    <div className="player-seat">
                      {index} 号位
                    </div>
                    <div className="player-name">
                      {player.name}
                    </div>
                    <div className="player-score">
                      积分：{player.score}
                    </div>
                    <div className="player-discards">
                      弃牌：{player.discards}
                    </div>
                  </div>
                )
              ))}
            </div>
          </div>
        </div>
        
        <div className="game-play">
          <div className="card">
            <h3 className="card-title">您的手牌</h3>
            <div className="my-hand">
              {gameState.my_hand.map((tile, index) => (
                <div key={index} className="tile">
                  {tile.suit === 'man' && '万'}
                  {tile.suit === 'pin' && '筒'}
                  {tile.suit === 'sou' && '索'}
                  {tile.suit === 'wind' && '风'}
                  {tile.suit === 'dragon' && '龙'}
                  {tile.rank}
                </div>
              ))}
            </div>
            
            <div className="game-actions">
              <button
                className="btn btn-primary"
                onClick={() => handlePlay(gameState.my_hand[0])}
              >
                出牌
              </button>
              <button
                className="btn btn-secondary"
                onClick={handleRiichi}
              >
                立直
              </button>
            </div>
          </div>
          
          <div className="card">
            <h3 className="card-title">聊天</h3>
            <div className="chat-container">
              <div className="chat-messages">
                {chatMessages.map((msg) => (
                  <div key={msg.id} className="chat-message">
                    <div className="message-sender">{msg.sender}</div>
                    <div className="message-content">{msg.content}</div>
                    <div className="message-time">
                      {new Date(msg.timestamp).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
              <div className="chat-input">
                <input
                  type="text"
                  className="form-control"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="发送消息..."
                />
                <button
                  className="btn btn-primary"
                  onClick={handleSendMessage}
                >
                  发送
                </button>
              </div>
            </div>
          </div>
        </div>
        
        {error && (
          <div className="error-message text-danger">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}

export default Game;
