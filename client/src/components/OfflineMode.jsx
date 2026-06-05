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
  };

  const handlePlayerShoot = (x, y) => {
    if (phase !== 'playing' || turn !== 'player') return;
    
    setPlayerShots(prev => prev + 1);

    // Check if already shot
    if (botBoard[y][x] === 'hit' || botBoard[y][x] === 'miss' || botBoard[y][x] === 'sunk') return;

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

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 500);
  };

  // Bot logic
  useEffect(() => {
    if (phase === 'playing' && turn === 'bot') {
      const timer = setTimeout(() => {
        botShoot();
      }, 1000); // 1 second delay for bot
      return () => clearTimeout(timer);
    }
  }, [turn, phase, botShotTrigger]);

  const botShoot = () => {
    playSound('shoot');
    const newPlayerBoard = [...playerBoard.map(row => [...row])];
    const newPlayerShips = [...playerShips];

    let targetCoords = null;
    
    // Smart AI Logic
    const hitCells = [];
    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 10; c++) {
        if (newPlayerBoard[r][c] === 'hit') hitCells.push({x: c, y: r});
      }
    }

    if (hitCells.length > 0) {
      const potentialTargets = [];
      const directions = [[0, -1], [0, 1], [-1, 0], [1, 0]];
      
      let isHorizontalLine = false;
      let isVerticalLine = false;

      // Check if any two hit cells are adjacent
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

      const getValidTargets = (targets) => targets.filter(t => {
        if (t.x < 0 || t.x >= 10 || t.y < 0 || t.y >= 10) return false;
        const state = newPlayerBoard[t.y][t.x];
        return state !== 'hit' && state !== 'miss' && state !== 'sunk';
      });

      let validTargets = getValidTargets(potentialTargets);

      // Fallback if the line assumption yielded no valid targets (e.g. blocked by misses or edges, meaning ships are touching)
      if (validTargets.length === 0 && (isHorizontalLine || isVerticalLine)) {
         const fallbackTargets = [];
         for (const cell of hitCells) {
           for (const [dx, dy] of directions) {
             fallbackTargets.push({x: cell.x + dx, y: cell.y + dy});
           }
         }
         validTargets = getValidTargets(fallbackTargets);
      }

      if (validTargets.length > 0) {
        targetCoords = validTargets[Math.floor(Math.random() * validTargets.length)];
      }
    }

    let x, y;
    if (targetCoords) {
      x = targetCoords.x;
      y = targetCoords.y;
    } else {
      // Parity hunt algorithm
      const availableCells = [];
      for (let r = 0; r < 10; r++) {
        for (let c = 0; c < 10; c++) {
          if (newPlayerBoard[r][c] !== 'hit' && newPlayerBoard[r][c] !== 'miss' && newPlayerBoard[r][c] !== 'sunk') {
            if ((r + c) % 2 === 0) availableCells.push({x: c, y: r});
          }
        }
      }
      
      // Fallback if parity cells are exhausted
      if (availableCells.length === 0) {
        for (let r = 0; r < 10; r++) {
          for (let c = 0; c < 10; c++) {
            if (newPlayerBoard[r][c] !== 'hit' && newPlayerBoard[r][c] !== 'miss' && newPlayerBoard[r][c] !== 'sunk') {
              availableCells.push({x: c, y: r});
            }
          }
        }
      }

      const randomCell = availableCells[Math.floor(Math.random() * availableCells.length)];
      x = randomCell.x;
      y = randomCell.y;
    }

    let isHit = false;

    if (newPlayerBoard[y][x] !== null && newPlayerBoard[y][x] !== 'hit' && newPlayerBoard[y][x] !== 'miss') {
      isHit = true;
      const shipId = newPlayerBoard[y][x];
      const ship = newPlayerShips.find(s => s.id === shipId);
      if (ship) {
        const pos = ship.positions.find(p => p.x === x && p.y === y);
        if (pos) pos.hit = true;
        newPlayerBoard[y][x] = 'hit';
        
        if (ship.positions.every(p => p.hit)) {
          ship.positions.forEach(p => newPlayerBoard[p.y][p.x] = 'sunk');
          playSound('sunk');
          setSinkingShip(ship);
          setTimeout(() => setSinkingShip(null), 3000);
        } else {
          playSound('hit');
          triggerShake();
        }
      }
    } else {
      newPlayerBoard[y][x] = 'miss';
      playSound('miss');
    }

    setPlayerBoard(newPlayerBoard);
    setPlayerShips(newPlayerShips);

    if (checkWin(newPlayerShips)) {
      setTimeout(() => {
        playSound('lose');
        setWinner('Máy tính');
        setPhase('gameover');
      }, 1000);
      return;
    }

    if (!isHit) {
      setTurn('player');
    } else {
      setBotShotTrigger(prev => prev + 1);
    }
  };

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
        <ShipSetup 
          playerBoard={playerBoard}
          setPlayerBoard={setPlayerBoard}
          playerShips={playerShips}
          setPlayerShips={setPlayerShips}
          onReady={startGame}
        />
      )}

      {phase === 'playing' && (
        <div className="panel" style={{ textAlign: 'center', padding: '1rem 2rem' }}>
          <h2 className="military-text" style={{ color: turn === 'player' ? 'var(--color-radar-green)' : 'var(--color-alert-red)' }}>
            LƯỢT CỦA: {turn === 'player' ? 'BẠN' : 'MÁY TÍNH'}
          </h2>
        </div>
      )}

      {phase !== 'setup' && (
        <div className="board-container">
          <div style={{ opacity: turn === 'bot' && phase === 'playing' ? 0.5 : 1, transition: 'opacity 0.3s' }} onClick={() => { if (turn === 'player' && phase === 'playing') playSound('shoot'); }}>
            <Board 
              title="LƯỚI RADAR (MÁY TÍNH)" 
              grid={botBoard} 
              hideShips={phase !== 'gameover'} 
              onCellClick={handlePlayerShoot} 
              shipsData={botShips}
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
