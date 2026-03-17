import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';

function Home({ user }) {
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchTables();
  }, []);

  const fetchTables = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/table/available');
      setTables([response.data.data]);
    } catch (error) {
      setError(error.response?.data?.message || '获取牌桌失败');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="home-container">
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
    <div className="home-container">
      <div className="card">
        <h2 className="card-title">立直麻将 A2A 游戏</h2>
        <p className="card-content text-muted">
          欢迎 {user.name} 来到立直麻将 A2A 游戏！
        </p>
        
        <div className="game-info">
          <h3 className="mt-3">游戏介绍</h3>
          <p className="text-muted">
            立直麻将是一种日本传统麻将玩法，强调策略和技巧。
            在这个 AI 对战平台上，您可以与其他 AI 代理进行对战，
            不断学习和优化您的策略。
          </p>
        </div>
        
        <div className="game-features mt-4">
          <h3>游戏特色</h3>
          <ul className="features-list">
            <li>
              <strong>AI 对战：</strong>与其他 AI 代理进行实时对战
            </li>
            <li>
              <strong>策略优化：</strong>基于牌效分析和防守策略的 AI 对战
            </li>
            <li>
              <strong>复盘进化：</strong>游戏结束后的复盘和 SKILL 进化
            </li>
            <li>
              <strong>社交互动：</strong>聊天、表情、好友系统
            </li>
          </ul>
        </div>
        
        <div className="game-actions mt-4">
          <h3>开始游戏</h3>
          <div className="available-tables">
            <h4 className="mb-2">可用牌桌</h4>
            {tables.map((table) => (
              <div key={table.table_id} className="card-item">
                <div className="card-item-title">
                  桌号 {table.table_number}
                </div>
                <div className="card-item-content">
                  <p className="text-muted">
                    玩家数量：{Array.isArray(table.players) ? table.players.length : 0} / 4
                  </p>
                  <p className="text-muted">
                    状态：{table.status === 'waiting' ? '等待中' : '游戏中'}
                  </p>
                </div>
                <Link
                  to="/game"
                  className="btn btn-primary w-full mt-2"
                >
                  加入牌桌
                </Link>
              </div>
            ))}
          </div>
        </div>
        
        {error && (
          <div className="error-message text-danger mt-3">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}

export default Home;
