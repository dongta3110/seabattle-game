import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Board from './Board';
import ShipSetup from './ShipSetup';
import ShipOverlay from './ShipOverlay';
import { generateRandomBoard, createEmptyBoard, checkWin } from '../utils/gameLogic';
import { playSound } from '../utils/SoundFX';

export default function OfflineMode() {
  const navigate = useNavigate();

  // Phases: 'setup', 'playing', 'gameover'
  const [phase, setPhase] = useState('setup');
  const [turn, setTurn] = useState('player'); // 'player' or 'bot'
  const [winner, setWinner] = useState(null);
  const [botShotTrigger, setBotShotTrigger] = useState(0);
  
  // Game Mode
  const [gameMode, setGameMode] = useState('classic'); // 'classic' or 'salvo'
  const [salvoTargets, setSalvoTargets] = useState([]);

  // FX States
  const [shake, setShake] = useState(false);
  const [sinkingShip, setSinkingShip] = useState(null);
  
  // Stats
  const [playerShots, setPlayerShots] = useState(0);
  const [playerHits, setPlayerHits] = useState(0);

  // Player state
  const [playerBoard, setPlayerBoard] = useState(createEmptyBoard());
  const [playerShips, setPlayerShips] = useState([]);

  // Bot state
  const [botBoard, setBotBoard] = useState(createEmptyBoard());
  const [botShips, setBotShips] = useState([]);

  // Initialize bot board on mount
  useEffect(() => {
    const { board, placedShips } = generateRandomBoard();
    setBotBoard(board);
    setBotShips(placedShips);
  }, []);

  const startGame = () => {
    if (playerShips.length === 0) return;
    setPhase('playing');
    setSalvoTargets([]);
  };

  const getLivingShipsCount = (ships) => {
    return ships.filter(ship => !ship.positions.every(p => p.hit)).length;
  };

  const handlePlayerShoot = (x, y) => {
    if (phase !== 'playing' || turn !== 'player') return;
    if (botBoard[y][x] === 'hit' || botBoard[y][x] === 'miss' || botBoard[y][x] === 'sunk') return;

    if (gameMode === 'salvo') {
      const maxShots = getLivingShipsCount(playerShips);
      const existingIdx = salvoTargets.findIndex(t => t.x === x && t.y === y);
      if (existingIdx >= 0) {
        setSalvoTargets(prev => prev.filter((_, i) => i !== existingIdx));
        playSound('shoot'); // Light sound for deselect
      } else {
        if (salvoTargets.length < maxShots) {
          setSalvoTargets(prev => [...prev, {x, y}]);
          playSound('shoot'); // Light sound for select
        }
      }
      return;
    }

    // Classic Logic
    setPlayerShots(prev => prev + 1);
    const newBotBoard = [...botBoard.map(row => [...row])];
    const newBotShips = [...botShips];
    let isHit = false;

    if (newBotBoard[y][x] !== null && newBotBoard[y][x] !== 'hit' && newBotBoard[y][x] !== 'miss') {
      isHit = true;
      setPlayerHits(prev => prev + 1);
      
      const shipId = newBotBoard[y][x];
      const ship = newBotShips.find(s => s.id === shipId);
      if (ship) {
        const pos = ship.positions.find(p => p.x === x && p.y === y);
        if (pos) pos.hit = true;
        newBotBoard[y][x] = 'hit';
        
        if (ship.positions.every(p => p.hit)) {
          ship.positions.forEach(p => newBotBoard[p.y][p.x] = 'sunk');
          playSound('sunk');
          setSinkingShip(ship);
          setTimeout(() => setSinkingShip(null), 3000);
        } else {
          playSound('hit');
          triggerShake();
        }
      }
    } else {
      newBotBoard[y][x] = 'miss';
      playSound('miss');
    }

    setBotBoard(newBotBoard);
    setBotShips(newBotShips);

    if (checkWin(newBotShips)) {
      setTimeout(() => {
        playSound('win');
        setWinner('Bạn');
        setPhase('gameover');
      }, 1000);
      return;
    }

    if (!isHit) {
      setTurn('bot');
    }
  };

  const firePlayerSalvo = () => {
    if (salvoTargets.length === 0) return;
    
    setPlayerShots(prev => prev + salvoTargets.length);
    playSound('salvo_fire', { count: salvoTargets.length });

    const newBotBoard = [...botBoard.map(row => [...row])];
    const newBotShips = [...botShips];
    let hitCount = 0;
    let anySunk = false;

    for (let target of salvoTargets) {
      const { x, y } = target;
      if (newBotBoard[y][x] !== null && newBotBoard[y][x] !== 'hit' && newBotBoard[y][x] !== 'miss') {
        hitCount++;
        const shipId = newBotBoard[y][x];
        const ship = newBotShips.find(s => s.id === shipId);
        if (ship) {
          const pos = ship.positions.find(p => p.x === x && p.y === y);
          if (pos) pos.hit = true;
          newBotBoard[y][x] = 'hit';
          
          if (ship.positions.every(p => p.hit)) {
            ship.positions.forEach(p => newBotBoard[p.y][p.x] = 'sunk');
            anySunk = true;
            // setSinkingShip logic is tricky for multiple ships, let's just trigger shake and sound
          }
        }
      } else {
        newBotBoard[y][x] = 'miss';
      }
    }

    setPlayerHits(prev => prev + hitCount);
    setBotBoard(newBotBoard);
    setBotShips(newBotShips);
    setSalvoTargets([]);

    if (anySunk) {
      playSound('sunk');
      triggerShake();
    } else if (hitCount > 0) {
      triggerShake();
    }

    if (checkWin(newBotShips)) {
      setTimeout(() => {
        playSound('win');
        setWinner('Bạn');
        setPhase('gameover');
      }, 1000);
      return;
    }

    // Salvo mode always changes turn
    setTimeout(() => {
      setTurn('bot');
    }, 1000);
  };

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 500);
  };

  // Bot logic
  useEffect(() => {
    if (phase === 'playing' && turn === 'bot') {
      const timer = setTimeout(() => {
        botShoot();
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [turn, phase, botShotTrigger]);

  const botShoot = () => {
    const newPlayerBoard = [...playerBoard.map(row => [...row])];
    const newPlayerShips = [...playerShips];

    // Identify hit cells for smart hunting
    const hitCells = [];
    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 10; c++) {
        if (newPlayerBoard[r][c] === 'hit') hitCells.push({x: c, y: r});
      }
    }

    const directions = [[0, -1], [0, 1], [-1, 0], [1, 0]];
    const getValidTargets = (targets) => targets.filter(t => {
      if (t.x < 0 || t.x >= 10 || t.y < 0 || t.y >= 10) return false;
      const state = newPlayerBoard[t.y][t.x];
      return state !== 'hit' && state !== 'miss' && state !== 'sunk';
    });

    const maxShots = gameMode === 'salvo' ? getLivingShipsCount(botShips) : 1;
    const selectedTargets = [];

    // Helper to get remaining valid random cells
    const getRandomCells = (count, exclude) => {
       const available = [];
       for (let r = 0; r < 10; r++) {
         for (let c = 0; c < 10; c++) {
           const state = newPlayerBoard[r][c];
           if (state !== 'hit' && state !== 'miss' && state !== 'sunk') {
              if (!exclude.some(t => t.x === c && t.y === r)) {
                 available.push({x: c, y: r});
              }
           }
         }
       }
       // Prioritize parity cells
       const parity = available.filter(t => (t.x + t.y) % 2 === 0);
       const pool = parity.length >= count ? parity : available;
       
       // Shuffle pool
       for (let i = pool.length - 1; i > 0; i--) {
         const j = Math.floor(Math.random() * (i + 1));
         [pool[i], pool[j]] = [pool[j], pool[i]];
       }
       return pool.slice(0, count);
    };

    // Smart AI Logic
    let potentialTargets = [];
    if (hitCells.length > 0) {
      let isHorizontalLine = false;
      let isVerticalLine = false;

      for (let i = 0; i < hitCells.length; i++) {
        for (let j = i + 1; j < hitCells.length; j++) {
           const dx = Math.abs(hitCells[i].x - hitCells[j].x);
           const dy = Math.abs(hitCells[i].y - hitCells[j].y);
           if (dx === 1 && dy === 0) isHorizontalLine = true;
           if (dx === 0 && dy === 1) isVerticalLine = true;
        }
      }

      for (const cell of hitCells) {
        if (isHorizontalLine && !isVerticalLine) {
           potentialTargets.push({x: cell.x - 1, y: cell.y});
           potentialTargets.push({x: cell.x + 1, y: cell.y});
        } else if (isVerticalLine && !isHorizontalLine) {
           potentialTargets.push({x: cell.x, y: cell.y - 1});
           potentialTargets.push({x: cell.x, y: cell.y + 1});
        } else {
           for (const [dx, dy] of directions) {
             potentialTargets.push({x: cell.x + dx, y: cell.y + dy});
           }
        }
      }

      let validSmartTargets = getValidTargets(potentialTargets);
      
      // Fallback
      if (validSmartTargets.length === 0 && (isHorizontalLine || isVerticalLine)) {
         const fallbackTargets = [];
         for (const cell of hitCells) {
           for (const [dx, dy] of directions) {
             fallbackTargets.push({x: cell.x + dx, y: cell.y + dy});
           }
         }
         validSmartTargets = getValidTargets(fallbackTargets);
      }

      // Unique smart targets
      const uniqueSmart = [];
      validSmartTargets.forEach(t => {
        if (!uniqueSmart.some(u => u.x === t.x && u.y === t.y)) {
           uniqueSmart.push(t);
        }
      });

      // Add to selected
      for (const st of uniqueSmart) {
        if (selectedTargets.length < maxShots) {
          selectedTargets.push(st);
        }
      }
    }

    // Fill the rest with random
    if (selectedTargets.length < maxShots) {
      const needed = maxShots - selectedTargets.length;
      const randoms = getRandomCells(needed, selectedTargets);
      selectedTargets.push(...randoms);
    }

    if (gameMode === 'salvo') {
      playSound('salvo_fire', { count: selectedTargets.length });
    } else {
      playSound('shoot');
    }

    let hitCount = 0;
    let anySunk = false;

    for (const target of selectedTargets) {
      const { x, y } = target;
      if (newPlayerBoard[y][x] !== null && newPlayerBoard[y][x] !== 'hit' && newPlayerBoard[y][x] !== 'miss') {
        hitCount++;
        const shipId = newPlayerBoard[y][x];
        const ship = newPlayerShips.find(s => s.id === shipId);
        if (ship) {
          const pos = ship.positions.find(p => p.x === x && p.y === y);
          if (pos) pos.hit = true;
          newPlayerBoard[y][x] = 'hit';
          
          if (ship.positions.every(p => p.hit)) {
            ship.positions.forEach(p => newPlayerBoard[p.y][p.x] = 'sunk');
            anySunk = true;
            setSinkingShip(ship);
            setTimeout(() => setSinkingShip(null), 3000);
          }
        }
      } else {
        newPlayerBoard[y][x] = 'miss';
      }
    }

    setPlayerBoard(newPlayerBoard);
    setPlayerShips(newPlayerShips);

    if (anySunk) {
      playSound('sunk');
      triggerShake();
    } else if (hitCount > 0 && gameMode === 'salvo') {
      triggerShake();
    } else if (hitCount > 0 && gameMode === 'classic') {
      playSound('hit');
      triggerShake();
    } else if (hitCount === 0 && gameMode === 'classic') {
      playSound('miss');
    }

    if (checkWin(newPlayerShips)) {
      setTimeout(() => {
        playSound('lose');
        setWinner('Máy tính');
        setPhase('gameover');
      }, 1000);
      return;
    }

    if (gameMode === 'salvo') {
      setTimeout(() => {
        setTurn('player');
      }, 1000);
    } else {
      if (hitCount === 0) {
        setTurn('player');
      } else {
        setBotShotTrigger(prev => prev + 1);
      }
    }
  };

  const maxPlayerShots = getLivingShipsCount(playerShips);

  return (
    <div style={{ position: 'relative' }} className={shake ? 'shake-active' : ''}>
      <button 
        className="btn" 
        style={{ position: 'absolute', top: 0, left: 0, padding: '0.5rem 1rem', fontSize: '1rem', zIndex: 100 }}
        onClick={() => navigate('/')}
      >
        ⬅ TRỞ LẠI MENU
      </button>

      <h2 className="neon-title-small" style={{ marginTop: '3rem', textAlign: 'center' }}>
        OFFLINE MODE {phase === 'playing' ? (turn === 'player' ? ' - LƯỢT CỦA BẠN' : ' - MÁY TÍNH ĐANG BẮN...') : ''}
      </h2>
      
      {phase === 'setup' && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div className="panel" style={{ padding: '1rem', marginBottom: '2rem', display: 'flex', gap: '2rem', alignItems: 'center' }}>
            <h3 style={{ margin: 0 }}>CHẾ ĐỘ CHƠI:</h3>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button 
                className={`btn ${gameMode === 'classic' ? 'btn-primary' : ''}`}
                onClick={() => setGameMode('classic')}
              >
                CƠ BẢN
              </button>
              <button 
                className={`btn ${gameMode === 'salvo' ? 'btn-primary cyber-btn-red' : ''}`}
                onClick={() => setGameMode('salvo')}
                style={{ borderColor: gameMode === 'salvo' ? 'var(--color-alert-red)' : '' }}
              >
                SALVO (MƯA BOM)
              </button>
            </div>
          </div>
          <ShipSetup 
            playerBoard={playerBoard}
            setPlayerBoard={setPlayerBoard}
            playerShips={playerShips}
            setPlayerShips={setPlayerShips}
            onReady={startGame}
          />
        </div>
      )}

      {phase === 'playing' && (
        <div className="panel" style={{ textAlign: 'center', padding: '1rem 2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
          <h2 className="military-text" style={{ color: turn === 'player' ? 'var(--color-radar-green)' : 'var(--color-alert-red)', margin: 0 }}>
            LƯỢT CỦA: {turn === 'player' ? 'BẠN' : 'MÁY TÍNH'}
          </h2>
          
          {gameMode === 'salvo' && turn === 'player' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
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
      )}

      {phase !== 'setup' && (
        <div className="board-container">
          <div style={{ opacity: turn === 'bot' && phase === 'playing' ? 0.5 : 1, transition: 'opacity 0.3s' }}>
            <Board 
              title="LƯỚI RADAR (MÁY TÍNH)" 
              grid={botBoard} 
              hideShips={phase !== 'gameover'} 
              onCellClick={handlePlayerShoot} 
              shipsData={botShips}
              salvoTargets={salvoTargets}
            />
          </div>
          <div style={{ opacity: turn === 'player' && phase === 'playing' ? 0.5 : 1, transition: 'opacity 0.3s' }}>
            <Board 
              title="HẠM ĐỘI CỦA BẠN" 
              grid={playerBoard} 
              hideShips={false} 
              onCellClick={() => {}} 
              shipsData={playerShips}
            />
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
      {phase === 'gameover' && (
        <div className="gameover-overlay">
          <div className="gameover-panel">
            <h1 className={winner === 'Bạn' ? 'victory-title' : 'defeat-title'}>
              {winner === 'Bạn' ? 'VICTORY' : 'DEFEAT'}
            </h1>
            <p style={{ fontSize: '1.2rem', marginBottom: '2rem', color: 'var(--color-steel-light)' }}>
              Độ chính xác: {playerShots > 0 ? Math.round((playerHits / playerShots) * 100) : 0}% 
              ({playerHits}/{playerShots} phát)
            </p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              <button className="btn btn-primary" onClick={() => window.location.reload()}>CHƠI LẠI</button>
              <button className="btn" onClick={() => navigate('/')}>VỀ MENU</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
