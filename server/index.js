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

  socket.on('createRoom', () => {
    const roomId = generateRoomCode();
    rooms[roomId] = {
      players: [{ id: socket.id, ready: false, ships: [] }],
      turn: null,
      gameState: 'waiting', // waiting, playing, finished
    };
    socket.join(roomId);
    socket.emit('roomCreated', roomId);
    console.log(`Room created: ${roomId}`);
  });

  socket.on('joinRoom', (roomId) => {
    const room = rooms[roomId];
    if (room) {
      if (room.players.length < 2) {
        room.players.push({ id: socket.id, ready: false, ships: [] });
        socket.join(roomId);
        socket.emit('roomJoined', roomId);
        
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
    if (room && room.gameState === 'playing' && room.turn === socket.id) {
      const opponentIndex = room.players.findIndex(p => p.id !== socket.id);
      if (opponentIndex === -1) return; // Prevent crash if opponent is missing
      const opponent = room.players[opponentIndex];
      
      let isHit = false;
      let shipSunk = null;
      let sunkPositions = null;

      // Xử lý logic bắn ở server để tránh cheat
      for (let ship of opponent.ships) {
        for (let pos of ship.positions) {
          if (pos.x === x && pos.y === y) {
            isHit = true;
            pos.hit = true;
            
            // Check if sunk
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

      // Check win condition
      const isWin = opponent.ships.every(ship => ship.positions.every(p => p.hit));

      // Emit results
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
          // Change turn only if missed
          room.turn = opponent.id;
          io.to(roomId).emit('turnChange', { turn: room.turn });
        } else {
          // Notify that the same player gets another turn (optional, just for consistency)
          io.to(roomId).emit('turnChange', { turn: room.turn });
        }
      }
    }
  });

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
    // Handle player disconnect: remove from room, notify opponent
    for (const [roomId, room] of Object.entries(rooms)) {
      const playerIndex = room.players.findIndex(p => p.id === socket.id);
      if (playerIndex !== -1) {
        room.players.splice(playerIndex, 1);
        io.to(roomId).emit('playerDisconnected', 'Đối thủ đã thoát. Bạn đã thắng!');
        delete rooms[roomId]; // Simple cleanup
        break;
      }
    }
  });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
