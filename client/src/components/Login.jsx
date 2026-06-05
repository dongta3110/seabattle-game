import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function Login() {
  const { loginWithGoogle, loginAsGuest, currentUser } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');

  const handleLogin = async () => {
    try {
      setError('');
      await loginWithGoogle();
      navigate('/online');
    } catch (err) {
      if (err.message && err.message.includes('auth/invalid-api-key')) {
        setError('Firebase chưa được cấu hình. Vui lòng thêm config vào firebase.js hoặc .env');
      } else {
        setError('Lỗi đăng nhập: ' + err.message);
      }
    }
  };

  const handleGuestLogin = () => {
    loginAsGuest();
    navigate('/online');
  };

  if (currentUser) {
    return (
      <div className="menu-screen">
        <div className="panel" style={{ textAlign: 'center' }}>
          <h2>Đã đăng nhập với tên: {currentUser.displayName}</h2>
          <button className="btn btn-primary" onClick={() => navigate('/online')} style={{ marginTop: '1rem' }}>
            Vào phòng chờ Online
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="menu-screen">
      <h1 className="title">ĐĂNG NHẬP</h1>
      <div className="panel" style={{ width: '400px', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <p style={{ textAlign: 'center' }}>Để chơi Online, bạn cần đăng nhập.</p>
        
        {error && (
          <p style={{ color: 'var(--color-alert-red)', textAlign: 'center', fontSize: '0.9rem' }}>
            {error}
          </p>
        )}

        <button className="btn btn-primary" onClick={handleLogin}>
          ĐĂNG NHẬP BẰNG GOOGLE
        </button>
        
        <button className="btn" onClick={handleGuestLogin} style={{ borderColor: 'var(--color-steel-light)', color: 'var(--color-steel-light)' }}>
          BỎ QUA & CHƠI NHƯ KHÁCH
        </button>

        <button className="btn" onClick={() => navigate('/')}>
          QUAY LẠI
        </button>
      </div>
    </div>
  );
}
