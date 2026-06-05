import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import './index.css';

import OfflineMode from './components/OfflineMode';
import OnlineMode from './components/OnlineMode';
import Login from './components/Login';
import { AuthProvider, useAuth } from './contexts/AuthContext';

function MainMenu() {
  const navigate = useNavigate();
  const { currentUser, logout } = useAuth();
  
  return (
    <div className="menu-screen">
      <div className="radar-bg"></div>
      <div className="radar-sweep"></div>
      
      <div className="menu-content">
        <div className="game-logo-container">
          <h1 className="title neon-title" data-text="SEA BATTLE">SEA BATTLE</h1>
          <p className="subtitle typing-effect">GAME BY ĐÔNG TÀ</p>
        </div>

        <div className="panel high-tech-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '400px' }}>
          <div className="panel-corner top-left"></div>
          <div className="panel-corner top-right"></div>
          <div className="panel-corner bottom-left"></div>
          <div className="panel-corner bottom-right"></div>
          
          <button className="btn btn-primary cyber-btn" onClick={() => navigate('/offline')}>
            <span className="btn-bracket">[</span> PLAY OFFLINE (VS BOT) <span className="btn-bracket">]</span>
          </button>
          
          {currentUser ? (
            <>
              {!currentUser.isGuest && (
                <div className="commander-info">
                  <span className="blink-dot"></span>
                  CHỈ HUY: <b style={{ color: 'white', fontSize: '1.2rem', marginLeft: '8px' }}>{currentUser.displayName}</b>
                </div>
              )}
              <button className="btn cyber-btn" onClick={() => navigate('/online')}>
                <span className="btn-bracket">[</span> VÀO PHÒNG CHỜ ONLINE <span className="btn-bracket">]</span>
              </button>
              <button className="btn cyber-btn-red" onClick={async () => await logout()}>
                <span className="btn-bracket">[</span> ĐĂNG XUẤT <span className="btn-bracket">]</span>
              </button>
            </>
          ) : (
            <button className="btn cyber-btn" onClick={() => navigate('/login')}>
              <span className="btn-bracket">[</span> ĐĂNG NHẬP ĐỂ CHƠI ONLINE <span className="btn-bracket">]</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="container">
          <Routes>
            <Route path="/" element={<MainMenu />} />
            <Route path="/offline" element={<OfflineMode />} />
            <Route path="/online" element={<OnlineMode />} />
            <Route path="/login" element={<Login />} />
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
