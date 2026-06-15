import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();
app.use(cors());

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*", // Allow all for now
    methods: ["GET", "POST"]
  }
});

const rooms = {};

// Generator for 6 digit room codes
function generateRoomCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.on('createRoom', (gameMode = 'classic') => {
    const roomId = generateRoomCode();
    rooms[roomId] = {
      players: [{ id: socket.id, ready: false, ships: [], receivedShots: [], skipTurn: false }],
      turn: null,
      gameState: 'waiting', // waiting, playing, finished
      gameMode: gameMode
    };
    socket.join(roomId);
    socket.emit('roomCreated', { id: roomId, gameMode });
    console.log(`Room created: ${roomId} with mode ${gameMode}`);
  });

  socket.on('joinRoom', (roomId) => {
    const room = rooms[roomId];
    if (room) {
      if (room.players.length < 2) {
        room.players.push({ id: socket.id, ready: false, ships: [], receivedShots: [], skipTurn: false });
        socket.join(roomId);
        socket.emit('roomJoined', { id: roomId, gameMode: room.gameMode });
        
        if (room.players.length === 2) {
          io.to(roomId).emit('gameReady', 'Vui lòng đặt tàu để bắt đầu');
        }
      } else {
        socket.emit('roomError', 'Phòng đã đầy');
      }
    } else {
      socket.emit('roomError', 'Không tìm thấy phòng');
    }
  });

  socket.on('placeShips', ({ roomId, ships }) => {
    const room = rooms[roomId];
    if (room) {
      const playerIndex = room.players.findIndex(p => p.id === socket.id);
      if (playerIndex !== -1) {
        room.players[playerIndex].ships = ships;
        room.players[playerIndex].ready = true;

        io.to(roomId).emit('playerReady', { playerId: socket.id });

        const allReady = room.players.length === 2 && room.players.every(p => p.ready);
        if (allReady) {
          room.gameState = 'playing';
          // Randomize who goes first
          room.turn = room.players[Math.floor(Math.random() * 2)].id;
          io.to(roomId).emit('gameStart', { turn: room.turn });
        }
      }
    }
  });

  socket.on('shoot', ({ roomId, x, y }) => {
    const room = rooms[roomId];
    if (room && room.gameState === 'playing' && room.turn === socket.id && (room.gameMode === 'classic' || room.gameMode === 'mines')) {
      const opponentIndex = room.players.findIndex(p => p.id !== socket.id);
      if (opponentIndex === -1) return; 
      const opponent = room.players[opponentIndex];
      const shooterIndex = room.players.findIndex(p => p.id === socket.id);
      const shooter = room.players[shooterIndex];
      
      let isHit = false;
      let shipSunk = null;
      let sunkPositions = null;
      let isMineHit = false;
      let turnSkipped = false;
      let reflectedShipSunk = null;
      let reflectedSunkPositions = null;

      if (!opponent.receivedShots.some(s => s.x === x && s.y === y)) {
        opponent.receivedShots.push({ x, y });
      }

      for (let ship of opponent.ships) {
        for (let pos of ship.positions) {
          if (pos.x === x && pos.y === y) {
            if (ship.id.startsWith('mine')) {
              isMineHit = true;
              break;
            }
            isHit = true;
            pos.hit = true;
            
            const isSunk = ship.positions.every(p => p.hit);
            if (isSunk) {
              shipSunk = ship.id;
              sunkPositions = ship.positions.map(p => ({ x: p.x, y: p.y }));
            }
            break;
          }
        }
        if (isHit || isMineHit) break;
      }

      if (isMineHit) {
        const alreadyShot = shooter.receivedShots.some(s => s.x === x && s.y === y);
        if (alreadyShot) {
          shooter.skipTurn = true;
          turnSkipped = true;
        } else {
          shooter.receivedShots.push({ x, y });
          for (let ship of shooter.ships) {
            if (ship.id.startsWith('mine')) continue;
            for (let pos of ship.positions) {
              if (pos.x === x && pos.y === y) {
                pos.hit = true;
                const isSunk = ship.positions.every(p => p.hit);
                if (isSunk) {
                  reflectedShipSunk = ship.id;
                  reflectedSunkPositions = ship.positions.map(p => ({ x: p.x, y: p.y }));
                }
                break;
              }
            }
          }
        }
      }

      const battleShipsOpponent = opponent.ships.filter(s => !s.id.startsWith('mine'));
      const isWin = battleShipsOpponent.length > 0 && battleShipsOpponent.every(ship => ship.positions.every(p => p.hit));
      
      const battleShipsShooter = shooter.ships.filter(s => !s.id.startsWith('mine'));
      const isLose = battleShipsShooter.length > 0 && battleShipsShooter.every(ship => ship.positions.every(p => p.hit));

      io.to(roomId).emit('shotResult', {
        x, y,
        isHit,
        isMineHit,
        turnSkipped,
        reflectedShipSunk,
        reflectedSunkPositions,
        shooterId: socket.id,
        shipSunk,
        sunkPositions,
        isWin,
        isLose
      });

      if (isWin || isLose) {
        room.gameState = 'finished';
      } else {
        if (isMineHit || !isHit) {
           if (opponent.skipTurn) {
             opponent.skipTurn = false;
           } else {
             room.turn = opponent.id;
           }
        }
        io.to(roomId).emit('turnChange', { turn: room.turn });
      }
    }
  });

  socket.on('shoot_salvo', ({ roomId, targets }) => {
    const room = rooms[roomId];
    if (room && room.gameState === 'playing' && room.turn === socket.id && room.gameMode === 'salvo') {
      const opponentIndex = room.players.findIndex(p => p.id !== socket.id);
      if (opponentIndex === -1) return;
      const opponent = room.players[opponentIndex];
      
      const results = [];
      let isWin = false;

      // Evaluate each target
      for (let target of targets) {
        const { x, y } = target;
        let isHit = false;
        let shipSunk = null;
        let sunkPositions = null;

        for (let ship of opponent.ships) {
          for (let pos of ship.positions) {
            if (pos.x === x && pos.y === y) {
              isHit = true;
              pos.hit = true;
              
              const isSunk = ship.positions.every(p => p.hit);
              if (isSunk) {
                shipSunk = ship.id;
                sunkPositions = ship.positions.map(p => ({ x: p.x, y: p.y }));
              }
              break;
            }
          }
          if (isHit) break;
        }

        results.push({ x, y, isHit, shipSunk, sunkPositions });
      }

      isWin = opponent.ships.every(ship => ship.positions.every(p => p.hit));

      io.to(roomId).emit('salvoResult', {
        results,
        shooterId: socket.id,
        isWin
      });

      if (isWin) {
        room.gameState = 'finished';
      } else {
        const hitCount = results.filter(r => r.isHit).length;
        if (targets.length === 1 && hitCount > 0) {
           // Giữ nguyên lượt
        } else {
           room.turn = opponent.id;
        }
        io.to(roomId).emit('turnChange', { turn: room.turn });
      }
    }
  });

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
    for (const [roomId, room] of Object.entries(rooms)) {
      const playerIndex = room.players.findIndex(p => p.id === socket.id);
      if (playerIndex !== -1) {
        room.players.splice(playerIndex, 1);
        io.to(roomId).emit('playerDisconnected', 'Đối thủ đã thoát. Bạn đã thắng!');
        delete rooms[roomId]; 
        break;
      }
    }
  });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
