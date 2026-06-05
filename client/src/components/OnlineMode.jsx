import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import Board from './Board';
import ShipSetup from './ShipSetup';
import ShipOverlay from './ShipOverlay';
import { createEmptyBoard } from '../utils/gameLogic';
import { useAuth } from '../contexts/AuthContext';
import { playSound } from '../utils/SoundFX';

const SOCKET_SERVER_URL = "http://localhost:3001";

export default function OnlineMode() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  
  const [socket, setSocket] = useState(null);
  const [roomId, setRoomId] = useState('');
  const [joinRoomId, setJoinRoomId] = useState('');
  const [status, setStatus] = useState('lobby'); // lobby, setup, waiting, playing, gameover
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  
  // Game state
  const [playerBoard, setPlayerBoard] = useState(createEmptyBoard());
  const [playerShips, setPlayerShips] = useState([]);
  const [opponentBoard, setOpponentBoard] = useState(createEmptyBoard());
  const [sunkOpponentShips, setSunkOpponentShips] = useState([]);
  const [turn, setTurn] = useState(null);
  const [winner, setWinner] = useState(null);

  // FX States
  const [shake, setShake] = useState(false);
  const [sinkingShip, setSinkingShip] = useState(null);
  
  // Stats
  const [playerShots, setPlayerShots] = useState(0);
  const [playerHits, setPlayerHits] = useState(0);

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 500);
  };

  // Allow playing without login if they want, but usually require it
  const playerId = currentUser?.uid || `guest_${Math.floor(Math.random()*1000)}`;

  useEffect(() => {
    const newSocket = io(SOCKET_SERVER_URL);
    setSocket(newSocket);

    newSocket.on('roomCreated', (id) => {
      setRoomId(id);
      setStatus('setup');
      setMessage(`Đã tạo phòng. Mã phòng: ${id}. Đợi đối thủ tham gia...`);
    });

    newSocket.on('roomJoined', (id) => {
      setRoomId(id);
      setStatus('setup');
      setMessage('Đã tham gia phòng!');
    });

    newSocket.on('roomError', (msg) => {
      setError(msg);
    });

    newSocket.on('gameReady', (msg) => {
      setMessage(msg);
    });

    newSocket.on('playerReady', ({ playerId: id }) => {
      if (id === newSocket.id) {
        setStatus('waiting');
        setMessage('Đang chờ đối thủ...');
      }
    });

    newSocket.on('gameStart', ({ turn: currentTurn }) => {
      setStatus('playing');
      setTurn(currentTurn);
      setMessage('Trận chiến bắt đầu!');
    });

    newSocket.on('turnChange', ({ turn: currentTurn }) => {
      setTurn(currentTurn);
    });

    newSocket.on('shotResult', ({ x, y, isHit, shooterId, shipSunk, sunkPositions, isWin }) => {
      if (shooterId === newSocket.id) {
        // We shot
        setOpponentBoard(prev => {
          const newBoard = [...prev.map(row => [...row])];
          newBoard[y][x] = isHit ? 'hit' : 'miss';
          if (shipSunk && sunkPositions) {
            sunkPositions.forEach(p => newBoard[p.y][p.x] = 'sunk');
          }
          return newBoard;
        });

        if (isHit) setPlayerHits(prev => prev + 1);

        if (shipSunk && sunkPositions) {
          setMessage(`Bạn đã bắn chìm một tàu của đối phương!`);
          setSunkOpponentShips(prev => [...prev, { id: shipSunk, positions: sunkPositions }]);
          playSound('sunk');
          setSinkingShip({ id: shipSunk, positions: sunkPositions });
          setTimeout(() => setSinkingShip(null), 3000);
        } else {
          if (isHit) {
            playSound('hit');
            triggerShake();
          } else {
            playSound('miss');
          }
        }

        if (isWin) {
          setTimeout(() => {
            playSound('win');
            setWinner('Bạn');
            setStatus('gameover');
          }, 1000);
        }
      } else {
        // Opponent shot us
        setPlayerBoard(prev => {
          const newBoard = [...prev.map(row => [...row])];
          newBoard[y][x] = isHit ? 'hit' : 'miss';
          if (shipSunk && sunkPositions) {
            sunkPositions.forEach(p => newBoard[p.y][p.x] = 'sunk');
          }
          return newBoard;
        });

        if (shipSunk) {
          setMessage(`Một tàu của bạn đã bị chìm!`);
          playSound('sunk');
          setSinkingShip({ id: shipSunk, positions: sunkPositions });
          setTimeout(() => setSinkingShip(null), 3000);
        } else {
          if (isHit) {
            playSound('hit');
            triggerShake();
          } else {
            playSound('miss');
          }
        }

        if (isWin) {
          setTimeout(() => {
            playSound('lose');
            setWinner('Đối thủ');
            setStatus('gameover');
          }, 1000);
        }
      }
    });

    newSocket.on('playerDisconnected', (msg) => {
      setStatus('gameover');
      setWinner('Bạn (Đối thủ thoát)');
      setMessage(msg);
    });

    return () => newSocket.close();
  }, []);

  const createRoom = () => {
    setError('');
    socket.emit('createRoom');
  };

  const joinRoom = () => {
    setError('');
    if (joinRoomId) {
      socket.emit('joinRoom', joinRoomId);
    }
  };

  const confirmShips = () => {
    socket.emit('placeShips', { roomId, ships: playerShips });
  };

  const handleShoot = (x, y) => {
    if (status !== 'playing' || turn !== socket.id) return;
    if (opponentBoard[y][x] === 'hit' || opponentBoard[y][x] === 'miss' || opponentBoard[y][x] === 'sunk') return;
    
    setPlayerShots(prev => prev + 1);
    playSound('shoot');
    socket.emit('shoot', { roomId, x, y });
  };

  return (
    <div style={{ position: 'relative' }} className={shake ? 'shake-active' : ''}>
      <button 
        className="btn" 
        style={{ position: 'absolute', top: 0, left: 0, padding: '0.5rem 1rem', fontSize: '1rem', zIndex: 100 }}
        onClick={() => {
          if (socket) socket.disconnect();
          navigate('/');
        }}
      >
        ⬅ TRỞ LẠI MENU
      </button>

      <h2 className="neon-title-small" style={{ marginTop: '3rem', textAlign: 'center' }}>
        ONLINE MODE {roomId ? `- PHÒNG: ${roomId}` : ''}
      </h2>
      
      {status === 'lobby' && (
        <div className="panel" style={{ textAlign: 'center', width: '400px', margin: '0 auto' }}>
          <h3 style={{ marginBottom: '1.5rem' }}>Xin chào, {currentUser ? currentUser.displayName : 'Khách'}</h3>
          {error && <p style={{ color: 'var(--color-alert-red)', marginBottom: '1rem' }}>{error}</p>}
          <button className="btn btn-primary" onClick={createRoom} style={{ width: '100%', marginBottom: '1rem' }}>
            TẠO PHÒNG MỚI
          </button>
          <div style={{ margin: '1rem 0' }}>HOẶC</div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input 
              type="text" 
              placeholder="Nhập mã phòng" 
              value={joinRoomId}
              onChange={(e) => setJoinRoomId(e.target.value)}
              style={{ flex: 1, padding: '0.5rem', background: 'rgba(0,0,0,0.5)', color: 'white', border: '1px solid var(--color-steel)' }}
            />
            <button className="btn" onClick={joinRoom}>VÀO</button>
          </div>
          <button className="btn" onClick={() => navigate('/')} style={{ marginTop: '2rem' }}>QUAY LẠI</button>
        </div>
      )}

      {(status === 'setup' || status === 'waiting') && (
        <div className="panel" style={{ textAlign: 'center' }}>
          <h3 style={{ color: 'var(--color-radar-green)', marginBottom: '1rem' }}>Mã phòng: {roomId}</h3>
          <p style={{ marginBottom: '1rem' }}>{message}</p>
          
          {status === 'setup' ? (
            <ShipSetup 
              playerBoard={playerBoard}
              setPlayerBoard={setPlayerBoard}
              playerShips={playerShips}
              setPlayerShips={setPlayerShips}
              onReady={confirmShips}
            />
          ) : (
            <div style={{ transform: 'scale(0.8)', transformOrigin: 'top center' }}>
              <Board grid={playerBoard} hideShips={false} onCellClick={() => {}} title="HẠM ĐỘI CỦA BẠN" />
            </div>
          )}
        </div>
      )}

      {status === 'playing' && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
          <div className="panel" style={{ textAlign: 'center', padding: '1rem 2rem', marginBottom: '2rem' }}>
            <h2 className="military-text" style={{ color: turn === socket.id ? 'var(--color-radar-green)' : 'var(--color-alert-red)' }}>
              {turn === socket.id ? 'LƯỢT CỦA BẠN: KHAI HOẢ!' : 'ĐỐI THỦ ĐANG NGẮM BẮN...'}
            </h2>
            <p style={{ marginTop: '0.5rem' }}>{message}</p>
          </div>
          
          <div className="board-container">
            <div style={{ opacity: turn !== socket.id ? 0.5 : 1, transition: 'opacity 0.3s' }}>
              <Board 
                title="LƯỚI RADAR (ĐỐI THỦ)" 
                grid={opponentBoard} 
                hideShips={status !== 'gameover'} 
                onCellClick={handleShoot}
                shipsData={sunkOpponentShips} 
              />
            </div>
            <div style={{ opacity: turn === socket.id ? 0.5 : 1, transition: 'opacity 0.3s' }}>
              <Board 
                title="HẠM ĐỘI CỦA BẠN" 
                grid={playerBoard} 
                hideShips={false} 
                onCellClick={() => {}}
                shipsData={playerShips} 
              />
            </div>
          </div>
        </div>
      )}

      {/* Sinking Cinematic */}
      {sinkingShip && (
        <div className="cinematic-overlay">
          <div className="cinematic-ship-container">
            <ShipOverlay 
              shipId={sinkingShip.id} 
              size={sinkingShip.positions.length} 
              isVert={false} 
            />
          </div>
          <h1 className="cinematic-text">TÀU BỊ PHÁ HỦY!</h1>
        </div>
      )}

      {/* Victory / Defeat Overlay */}
      {status === 'gameover' && (
        <div className="gameover-overlay">
          <div className="gameover-panel">
            <h1 className={winner === 'Bạn' ? 'victory-title' : 'defeat-title'}>
              {winner === 'Bạn' ? 'VICTORY' : 'DEFEAT'}
            </h1>
            <p style={{ fontSize: '1.2rem', marginBottom: '1rem', color: 'var(--color-steel-light)' }}>
              Độ chính xác: {playerShots > 0 ? Math.round((playerHits / playerShots) * 100) : 0}% 
              ({playerHits}/{playerShots} phát)
            </p>
            <p style={{ marginBottom: '2rem', color: 'var(--color-steel)' }}>{message}</p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              <button className="btn btn-primary" onClick={() => {
                setStatus('lobby');
                setRoomId('');
                setJoinRoomId('');
                setPlayerBoard(createEmptyBoard());
                setOpponentBoard(createEmptyBoard());
                setSunkOpponentShips([]);
                setTurn(null);
                setWinner(null);
                setPlayerShots(0);
                setPlayerHits(0);
              }}>Chơi lại</button>
              <button className="btn" onClick={() => {
                if (socket) socket.disconnect();
                navigate('/');
              }}>VỀ MENU</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
