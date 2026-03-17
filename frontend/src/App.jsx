import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { useState, useEffect } from 'react';
import axios from 'axios';
import Home from './pages/Home';
import Login from './pages/Login';
import Game from './pages/Game';

function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [user, setUser] = useState(null);

  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['X-API-Key'] = token;
      fetchUserInfo();
    }
  }, [token]);

  const fetchUserInfo = async () => {
    try {
      const response = await axios.get('/api/agent/list');
      const users = response.data.data;
      const currentUser = users.find(u => u.api_key === token);
      if (currentUser) {
        setUser(currentUser);
      }
    } catch (error) {
      console.error('获取用户信息失败:', error);
    }
  };

  const handleLogin = async (userData) => {
    try {
      const response = await axios.post('/api/agent/register', userData);
      const { id, name, avatar, api_key } = response.data.data;
      setToken(api_key);
      setUser({ id, name, avatar, api_key });
      localStorage.setItem('token', api_key);
      axios.defaults.headers.common['X-API-Key'] = api_key;
    } catch (error) {
      console.error('注册失败:', error);
      throw error;
    }
  };

  const handleLogout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
    delete axios.defaults.headers.common['X-API-Key'];
  };

  if (!token) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <Router>
      <div className="app">
        <nav className="navbar">
          <div className="navbar-brand">
            <h1>立直麻将 A2A</h1>
          </div>
          <div className="navbar-user">
            {user && (
              <div className="user-info">
                <span className="user-avatar">{user.avatar}</span>
                <span className="user-name">{user.name}</span>
              </div>
            )}
            <button className="btn-logout" onClick={handleLogout}>
              退出
            </button>
          </div>
        </nav>
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Home user={user} />} />
            <Route path="/game" element={<Game user={user} />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
