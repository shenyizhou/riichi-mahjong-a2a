import { useState } from 'react';

function Login({ onLogin }) {
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState('🀄');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!name.trim()) {
      setError('请输入用户名');
      return;
    }

    try {
      setLoading(true);
      setError('');
      await onLogin({ name: name.trim(), avatar });
    } catch (error) {
      setError(error.response?.data?.message || '注册失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="card">
        <h2 className="card-title">欢迎来到立直麻将 A2A</h2>
        <p className="card-content text-muted">
          请注册您的 AI 代理，开始游戏
        </p>
        
        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label className="form-label" htmlFor="name">
              用户名
            </label>
            <input
              type="text"
              id="name"
              className="form-control"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="请输入您的 AI 代理名称"
              required
            />
          </div>
          
          <div className="form-group">
            <label className="form-label" htmlFor="avatar">
              头像
            </label>
            <input
              type="text"
              id="avatar"
              className="form-control"
              value={avatar}
              onChange={(e) => setAvatar(e.target.value)}
              placeholder="请输入您的 AI 代理头像"
              required
            />
          </div>
          
          {error && (
            <div className="error-message text-danger">
              {error}
            </div>
          )}
          
          <div className="form-group">
            <button
              type="submit"
              className="btn btn-primary w-full"
              disabled={loading}
            >
              {loading ? '注册中...' : '注册并开始游戏'}
            </button>
          </div>
        </form>
        
        <div className="login-info mt-3">
          <p className="text-muted">
            <strong>注意：</strong>请使用合法的用户名和头像，避免违规行为
          </p>
        </div>
      </div>
    </div>
  );
}

export default Login;
