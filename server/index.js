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
      players: [{ id: socket.id, ready: false, ships: [] }],
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
        room.players.push({ id: socket.id, ready: false, ships: [] });
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
    if (room && room.gameState === 'playing' && room.turn === socket.id && room.gameMode === 'classic') {
      const opponentIndex = room.players.findIndex(p => p.id !== socket.id);
      if (opponentIndex === -1) return; 
      const opponent = room.players[opponentIndex];
      
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

      const isWin = opponent.ships.every(ship => ship.positions.every(p => p.hit));

      io.to(roomId).emit('shotResult', {
        x, y,
        isHit,
        shooterId: socket.id,
        shipSunk,
        sunkPositions,
        isWin
      });

      if (isWin) {
        room.gameState = 'finished';
      } else {
        if (!isHit) {
          room.turn = opponent.id;
          io.to(roomId).emit('turnChange', { turn: room.turn });
        } else {
          io.to(roomId).emit('turnChange', { turn: room.turn });
        }
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
        // Salvo ALWAYS changes turn after firing
        room.turn = opponent.id;
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
