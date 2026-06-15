import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import Board from './Board';
import ShipSetup from './ShipSetup';
import ShipOverlay from './ShipOverlay';
import { createEmptyBoard, SHIPS, MINES } from '../utils/gameLogic';
import { useAuth } from '../contexts/AuthContext';
import { playSound } from '../utils/SoundFX';

const SOCKET_SERVER_URL = "https://seabattle-game.onrender.com";

export default function OnlineMode() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  
  const [socket, setSocket] = useState(null);
  const [roomId, setRoomId] = useState('');
  const [joinRoomId, setJoinRoomId] = useState('');
  const [status, setStatus] = useState('lobby'); // lobby, setup, waiting, playing, gameover
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [announcement, setAnnouncement] = useState('');
  
  // Game Mode
  const [lobbyMode, setLobbyMode] = useState('classic');
  const [gameMode, setGameMode] = useState('classic');
  const [salvoTargets, setSalvoTargets] = useState([]);

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

  const getLivingShipsCount = (ships) => {
    return ships.filter(ship => !ship.positions.every(p => p.hit)).length;
  };

  const playerId = currentUser?.uid || `guest_${Math.floor(Math.random()*1000)}`;

  useEffect(() => {
    const newSocket = io(SOCKET_SERVER_URL);
    setSocket(newSocket);

    newSocket.on('roomCreated', ({ id, gameMode }) => {
      setRoomId(id);
      setGameMode(gameMode);
      setStatus('setup');
      setMessage(`Đã tạo phòng [Chế độ ${gameMode === 'salvo' ? 'SALVO' : 'CƠ BẢN'}]. Mã phòng: ${id}. Đợi đối thủ tham gia...`);
    });

    newSocket.on('roomJoined', ({ id, gameMode }) => {
      setRoomId(id);
      setGameMode(gameMode);
      setStatus('setup');
      setMessage(`Đã tham gia phòng [Chế độ ${gameMode === 'salvo' ? 'SALVO' : 'CƠ BẢN'}]!`);
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

    // Classic Shot Result
    newSocket.on('shotResult', ({ x, y, isHit, isMineHit, turnSkipped, reflectedShipSunk, reflectedSunkPositions, shooterId, shipSunk, sunkPositions, isWin, isLose }) => {
      if (shooterId === newSocket.id) {
        // We shot
        setOpponentBoard(prev => {
          const newBoard = [...prev.map(row => [...row])];
          if (isMineHit) newBoard[y][x] = 'mine_hit';
          else newBoard[y][x] = isHit ? 'hit' : 'miss';
          if (shipSunk && sunkPositions) {
            sunkPositions.forEach(p => newBoard[p.y][p.x] = 'sunk');
          }
          return newBoard;
        });

        if (isHit) setPlayerHits(prev => prev + 1);

        if (isMineHit) {
          playSound('sunk'); // Explosion sound
          triggerShake();
          if (turnSkipped) {
             setAnnouncement('BẠN ĐẠP MÌN! BỊ MẤT LƯỢT!');
             setTimeout(() => setAnnouncement(''), 3000);
          } else {
             // We took damage
             setPlayerBoard(prev => {
                const nb = [...prev.map(row => [...row])];
                if (nb[y][x] !== null && nb[y][x] !== 'hit' && nb[y][x] !== 'miss' && !nb[y][x].startsWith('mine')) {
                   nb[y][x] = 'hit';
                   if (reflectedSunkPositions) {
                      reflectedSunkPositions.forEach(p => nb[p.y][p.x] = 'sunk');
                   }
                } else {
                   nb[y][x] = 'miss';
                }
                return nb;
             });
             setPlayerShips(prevShips => {
                const newShips = [...prevShips];
                for (let s of newShips) {
                   if (s.id.startsWith('mine')) continue;
                   for (let p of s.positions) {
                      if (p.x === x && p.y === y) p.hit = true;
                   }
                }
                return newShips;
             });
          }
        } else {
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
        }

        if (isWin) {
          setTimeout(() => {
            playSound('win');
            setWinner('Bạn');
            setStatus('gameover');
          }, 1000);
        } else if (isLose) {
          setTimeout(() => {
            playSound('lose');
            setWinner('Đối thủ');
            setStatus('gameover');
          }, 1000);
        }
      } else {
        // Opponent shot us
        setPlayerBoard(prev => {
          const newBoard = [...prev.map(row => [...row])];
          if (isMineHit) newBoard[y][x] = 'mine_hit';
          else newBoard[y][x] = isHit ? 'hit' : 'miss';
          if (shipSunk && sunkPositions) {
            sunkPositions.forEach(p => newBoard[p.y][p.x] = 'sunk');
          }
          return newBoard;
        });
        
        setPlayerShips(prevShips => {
          const newShips = [...prevShips];
          if (isHit) {
            for (let ship of newShips) {
              if (ship.id.startsWith('mine')) continue;
              for (let pos of ship.positions) {
                if (pos.x === x && pos.y === y) {
                  pos.hit = true;
                }
              }
            }
          }
          return newShips;
        });

        if (isMineHit) {
          playSound('sunk');
          triggerShake();
          if (turnSkipped) {
             setAnnouncement('ĐỐI THỦ ĐẠP MÌN! BẠN ĐƯỢC BẮN THÊM LƯỢT!');
             setTimeout(() => setAnnouncement(''), 3000);
          } else {
             // Opponent took damage
             setOpponentBoard(prev => {
                const nb = [...prev.map(row => [...row])];
                if (nb[y][x] !== null && nb[y][x] !== 'hit' && nb[y][x] !== 'miss' && nb[y][x] !== 'mine_hit') {
                   nb[y][x] = 'hit';
                   if (reflectedSunkPositions) {
                      reflectedSunkPositions.forEach(p => nb[p.y][p.x] = 'sunk');
                   }
                } else {
                   nb[y][x] = 'miss';
                }
                return nb;
             });
          }
        } else {
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
        }

        if (isWin) {
          setTimeout(() => {
            playSound('lose');
            setWinner('Đối thủ');
            setStatus('gameover');
          }, 1000);
        } else if (isLose) {
          setTimeout(() => {
            playSound('win');
            setWinner('Bạn');
            setStatus('gameover');
          }, 1000);
        }
      }
    });

    // Salvo Shot Result
    newSocket.on('salvoResult', ({ results, shooterId, isWin }) => {
      let hitCount = 0;
      let anySunk = false;
      let lastSunk = null;

      if (shooterId === newSocket.id) {
        playSound('salvo_fire', { count: results.length });
        
        setOpponentBoard(prev => {
          const newBoard = [...prev.map(row => [...row])];
          results.forEach(res => {
            newBoard[res.y][res.x] = res.isHit ? 'hit' : 'miss';
            if (res.isHit) hitCount++;
            if (res.shipSunk && res.sunkPositions) {
              anySunk = true;
              lastSunk = { id: res.shipSunk, positions: res.sunkPositions };
              res.sunkPositions.forEach(p => newBoard[p.y][p.x] = 'sunk');
              setSunkOpponentShips(s => {
                if (!s.some(x => x.id === res.shipSunk)) {
                  return [...s, { id: res.shipSunk, positions: res.sunkPositions }];
                }
                return s;
              });
            }
          });
          return newBoard;
        });

        setPlayerHits(prev => prev + hitCount);

        if (anySunk) {
          setMessage(`Bạn đã bắn chìm tàu đối phương!`);
          playSound('sunk');
          setSinkingShip(lastSunk);
          setTimeout(() => setSinkingShip(null), 3000);
          triggerShake();
        } else if (hitCount > 0) {
          triggerShake();
        }

        if (isWin) {
          setTimeout(() => {
            playSound('win');
            setWinner('Bạn');
            setStatus('gameover');
          }, 1000);
        }
      } else {
        // Opponent shot us with Salvo
        playSound('salvo_fire', { count: results.length });
        
        setPlayerBoard(prev => {
          const newBoard = [...prev.map(row => [...row])];
          results.forEach(res => {
            newBoard[res.y][res.x] = res.isHit ? 'hit' : 'miss';
            if (res.isHit) hitCount++;
            if (res.shipSunk && res.sunkPositions) {
              anySunk = true;
              lastSunk = { id: res.shipSunk, positions: res.sunkPositions };
              res.sunkPositions.forEach(p => newBoard[p.y][p.x] = 'sunk');
            }
          });
          return newBoard;
        });

        setPlayerShips(prevShips => {
          const newShips = [...prevShips];
          results.forEach(res => {
            if (res.isHit) {
              for (let ship of newShips) {
                for (let pos of ship.positions) {
                  if (pos.x === res.x && pos.y === res.y) {
                    pos.hit = true;
                  }
                }
              }
            }
          });
          return newShips;
        });

        if (anySunk) {
          setMessage(`Tàu của bạn đã bị phá hủy!`);
          playSound('sunk');
          setSinkingShip(lastSunk);
          setTimeout(() => setSinkingShip(null), 3000);
          triggerShake();
        } else if (hitCount > 0) {
          triggerShake();
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
    socket.emit('createRoom', lobbyMode);
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
    
    if (gameMode === 'salvo') {
      const maxShots = getLivingShipsCount(playerShips);
      const existingIdx = salvoTargets.findIndex(t => t.x === x && t.y === y);
      if (existingIdx >= 0) {
        setSalvoTargets(prev => prev.filter((_, i) => i !== existingIdx));
        playSound('shoot');
      } else {
        if (salvoTargets.length < maxShots) {
          setSalvoTargets(prev => [...prev, {x, y}]);
          playSound('shoot');
        }
      }
      return;
    }

    setPlayerShots(prev => prev + 1);
    playSound('shoot');
    socket.emit('shoot', { roomId, x, y });
  };

  const firePlayerSalvo = () => {
    if (salvoTargets.length === 0) return;
    setPlayerShots(prev => prev + salvoTargets.length);
    socket.emit('shoot_salvo', { roomId, targets: salvoTargets });
    setSalvoTargets([]);
  };

  const maxPlayerShots = SHIPS.length - sunkOpponentShips.length;

  return (
    <div style={{ position: 'relative', paddingTop: '4rem' }} className={shake ? 'shake-active' : ''}>
      <button 
        className="btn" 
        style={{ position: 'absolute', top: '1rem', left: '1rem', padding: '0.5rem 1rem', fontSize: '1rem', zIndex: 100 }}
        onClick={() => {
          if (socket) socket.disconnect();
          navigate('/');
        }}
      >
        ⬅ TRỞ LẠI MENU
      </button>

      <h2 className="neon-title-small" style={{ marginTop: '0', textAlign: 'center' }}>
        ONLINE MODE {status === 'playing' ? (turn === socket.id ? ' - LƯỢT CỦA BẠN' : ' - ĐỐI THỦ ĐANG BẮN...') : ''}
      </h2>

      {announcement && (
        <div style={{ textAlign: 'center', color: 'var(--color-alert-red)', fontSize: '1.5rem', fontWeight: 'bold', margin: '1rem 0', animation: 'blink 1s infinite' }}>
          ⚠️ {announcement} ⚠️
        </div>
      )}
      
      {status === 'lobby' && (
        <div className="panel" style={{ textAlign: 'center', width: '400px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <h3 style={{ margin: 0 }}>Xin chào, {currentUser ? currentUser.displayName : 'Khách'}</h3>
          {error && <p style={{ color: 'var(--color-alert-red)', margin: 0 }}>{error}</p>}
          
          <div style={{ border: '1px solid var(--color-steel)', padding: '1rem', background: 'rgba(0,0,0,0.3)' }}>
            <h4 style={{ marginBottom: '1rem', color: 'var(--color-radar-green)' }}>TẠO PHÒNG MỚI</h4>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button 
                className={`btn ${lobbyMode === 'classic' ? 'btn-primary' : ''}`}
                onClick={() => setLobbyMode('classic')}
              >
                CƠ BẢN
              </button>
              <button 
                className={`btn ${lobbyMode === 'salvo' ? 'btn-primary cyber-btn-red' : ''}`}
                onClick={() => setLobbyMode('salvo')}
                style={{ borderColor: lobbyMode === 'salvo' ? 'var(--color-alert-red)' : '' }}
              >
                SALVO (MƯA BOM)
              </button>
              <button 
                className={`btn ${lobbyMode === 'mines' ? 'btn-primary cyber-btn-yellow' : ''}`}
                onClick={() => setLobbyMode('mines')}
                style={{ borderColor: lobbyMode === 'mines' ? '#ffcc00' : '' }}
              >
                THỦY LÔI TÀNG HÌNH
              </button>
            </div>
            <button className="btn btn-primary" onClick={createRoom} style={{ width: '100%' }}>
              TẠO PHÒNG
            </button>
          </div>

          <div>HOẶC</div>

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
          
          <button className="btn" onClick={() => navigate('/')} style={{ marginTop: '1rem' }}>QUAY LẠI</button>
        </div>
      )}

      {(status === 'setup' || status === 'waiting') && (
        <div className="panel" style={{ textAlign: 'center', width: '100%', maxWidth: '1200px', margin: '0 auto' }}>
          <h3 style={{ color: 'var(--color-radar-green)', marginBottom: '1rem' }}>Mã phòng: {roomId} ({gameMode === 'salvo' ? 'Chế độ Salvo' : 'Chế độ Cơ bản'})</h3>
          <p style={{ marginBottom: '1rem' }}>{message}</p>
          
          {status === 'setup' ? (
            <div style={{ display: 'flex', gap: '2rem', alignItems: 'flex-start', flexWrap: 'nowrap', justifyContent: 'center', width: '100%', maxWidth: '1600px', margin: '0 auto' }}>
              <div className="panel" style={{ flex: '1 1 200px', maxWidth: '350px', background: 'rgba(0,0,0,0.4)', border: '1px solid var(--color-steel)' }}>
                <h3 style={{ color: 'var(--color-radar-green)', borderBottom: '1px solid var(--color-steel)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
                  📖 HƯỚNG DẪN: {gameMode === 'classic' ? 'CƠ BẢN' : gameMode === 'salvo' ? 'SALVO' : 'THỦY LÔI'}
                </h3>
                {gameMode === 'classic' ? (
                  <ul style={{ textAlign: 'left', lineHeight: '1.8', paddingLeft: '1.2rem', color: 'var(--color-steel-light)', margin: 0 }}>
                    <li>Mỗi lượt bạn chỉ được khai hỏa <b>1 phát đạn</b>.</li>
                    <li>Nếu bắn trúng mục tiêu, bạn sẽ được thưởng <b>bắn thêm 1 lượt nữa</b>.</li>
                    <li>Sử dụng chuột để kéo thả tàu từ kho vũ khí vào bản đồ, hoặc bấm <b>Xếp ngẫu nhiên</b> cho nhanh.</li>
                    <li>Click chuột phải (hoặc nhấn phím R) khi đang giữ tàu để xoay ngang/dọc.</li>
                    <li>Tiêu diệt toàn bộ hạm đội địch trước để giành chiến thắng.</li>
                  </ul>
                ) : gameMode === 'salvo' ? (
                  <ul style={{ textAlign: 'left', lineHeight: '1.8', paddingLeft: '1.2rem', color: 'var(--color-steel-light)', margin: 0 }}>
                    <li>Trong chế độ Mưa Bom, bạn có thể khai hỏa <b>nhiều phát đạn cùng lúc</b>.</li>
                    <li>Số lượng đạn mỗi lượt tương đương với <b>số tàu còn sống của đối phương</b>. Tức là bắn nổ càng nhiều tàu địch, bạn càng có ít đạn.</li>
                    <li>Khi bạn chỉ còn <b>1 viên đạn</b> (đối phương chỉ còn 1 tàu), nếu bắn trúng, bạn sẽ được thưởng <b>bắn thêm 1 lượt nữa</b>!</li>
                    <li>Click vào lưới radar địch để <b>ghim mục tiêu</b> (xuất hiện tâm ngắm đỏ). Click lại để hủy ghim.</li>
                    <li>Sau khi nạp đủ đạn, nhấn <b>KHAI HỎA SALVO</b> để dội bom đồng loạt. Bắn xong sẽ tự động chuyển lượt.</li>
                  </ul>
                ) : (
                  <ul style={{ textAlign: 'left', lineHeight: '1.8', paddingLeft: '1.2rem', color: 'var(--color-steel-light)', margin: 0 }}>
                    <li>Đây là chế độ cơ bản nhưng bổ sung thêm <b>3 quả Thủy Lôi tàng hình</b> (1x1).</li>
                    <li>Mỗi lượt bạn được bắn 1 phát. Trúng mục tiêu được bắn tiếp.</li>
                    <li>Nếu đối phương bắn trúng Thủy Lôi của bạn, Thủy Lôi phát nổ và gây <b>sát thương dội ngược</b> trực tiếp vào ô tương ứng trên bản đồ của họ.</li>
                    <li>Nếu ô tương ứng đó đã bị bắn nát từ trước, đối phương sẽ bị phạt <b>mất lượt kế tiếp</b>!</li>
                  </ul>
                )}
              </div>

              <div style={{ flex: '0 0 auto' }}>
                <ShipSetup 
                  playerBoard={playerBoard}
                  setPlayerBoard={setPlayerBoard}
                  playerShips={playerShips}
                  setPlayerShips={setPlayerShips}
                  onReady={confirmShips}
                  shipDefinitions={gameMode === 'mines' ? [...SHIPS, ...MINES] : SHIPS}
                />
              </div>

              <div className="panel" style={{ flex: '1 1 200px', maxWidth: '350px', background: 'rgba(0,0,0,0.4)', border: '1px solid var(--color-steel)' }}>
                <h3 style={{ color: 'var(--color-alert-red)', borderBottom: '1px solid var(--color-steel)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
                  💡 MẸO CHIẾN THUẬT
                </h3>
                {gameMode === 'classic' ? (
                  <ul style={{ textAlign: 'left', lineHeight: '1.8', paddingLeft: '1.2rem', color: 'var(--color-steel-light)', margin: 0 }}>
                    <li>Tàu càng lớn càng dễ bị trúng đạn, nhưng tàu nhỏ lại rất khó dò ra!</li>
                    <li>Đừng xếp tàu sát nhau quá, đối phương dò trúng một tàu có thể sẽ quét nát cả khu vực xung quanh.</li>
                    <li>Hãy bắn theo đường chéo (bàn cờ ô vuông) để tiết kiệm số lần dò tìm hiệu quả nhất.</li>
                  </ul>
                ) : gameMode === 'salvo' ? (
                  <ul style={{ textAlign: 'left', lineHeight: '1.8', paddingLeft: '1.2rem', color: 'var(--color-steel-light)', margin: 0 }}>
                    <li>Hãy ưu tiên rải đạn bao trùm một khu vực rộng để tìm dấu vết của tàu địch.</li>
                    <li>Khi phát hiện có vết trúng đạn, ở lượt tiếp theo hãy <b>dồn toàn bộ hỏa lực</b> xung quanh ô đó để kết liễu con tàu nhanh nhất có thể.</li>
                    <li>Đừng vội nản chí nếu bạn mất tàu sớm. Hãy cố gắng tiêu diệt tàu địch để cắt giảm lượng đạn của chúng ở lượt sau!</li>
                  </ul>
                ) : (
                  <ul style={{ textAlign: 'left', lineHeight: '1.8', paddingLeft: '1.2rem', color: 'var(--color-steel-light)', margin: 0 }}>
                    <li>Thủy Lôi có kích thước nhỏ nhất (1x1), cực kỳ khó bị bắn trúng. Hãy đặt chúng ở những vị trí hiểm hóc.</li>
                    <li>Hãy ưu tiên đặt Thủy Lôi tại những nơi bạn đoán đối phương sẽ hay bắn vào (như các góc chéo).</li>
                    <li>Nhớ rằng hình phạt "Sát thương dội ngược" hoặc "Mất lượt" có thể lập tức xoay chuyển tình thế trận đấu!</li>
                  </ul>
                )}
              </div>
            </div>
          ) : (
            <div style={{ transform: 'scale(0.8)', transformOrigin: 'top center' }}>
              <Board grid={playerBoard} hideShips={false} onCellClick={() => {}} title="HẠM ĐỘI CỦA BẠN" />
            </div>
          )}
        </div>
      )}

      {status === 'playing' && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
          <div className="panel" style={{ textAlign: 'center', padding: '1rem 2rem', marginBottom: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
            <h2 className="military-text" style={{ color: turn === socket.id ? 'var(--color-radar-green)' : 'var(--color-alert-red)', margin: 0 }}>
              {turn === socket.id ? 'LƯỢT CỦA BẠN: KHAI HOẢ!' : 'ĐỐI THỦ ĐANG NGẮM BẮN...'}
            </h2>
            <p style={{ margin: 0 }}>{message}</p>

            {gameMode === 'salvo' && turn === socket.id && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '2rem', marginTop: '0.5rem' }}>
                <div style={{ fontSize: '1.2rem', color: 'var(--color-steel-light)' }}>
                  ĐẠN ĐANG NẠP: <b style={{ color: 'white' }}>{maxPlayerShots - salvoTargets.length} / {maxPlayerShots}</b>
                </div>
                <button 
                  className="btn btn-primary cyber-btn-red"
                  disabled={salvoTargets.length === 0}
                  onClick={firePlayerSalvo}
                  style={{
                    opacity: salvoTargets.length === 0 ? 0.5 : 1,
                    animation: salvoTargets.length > 0 ? 'pulse 1s infinite' : 'none'
                  }}
                >
                  KHAI HỎA SALVO!
                </button>
              </div>
            )}
          </div>
          
          <div className="board-container">
            <div style={{ opacity: turn !== socket.id ? 0.5 : 1, transition: 'opacity 0.3s' }}>
              <Board 
                title="LƯỚI RADAR (ĐỐI THỦ)" 
                grid={opponentBoard} 
                hideShips={status !== 'gameover'} 
                onCellClick={handleShoot}
                shipsData={sunkOpponentShips} 
                salvoTargets={salvoTargets}
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
                setSalvoTargets([]);
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
