export const BOARD_SIZE = 10;

export const SHIPS = [
  { id: 'carrier', name: 'Tàu Sân Bay', size: 5 },
  { id: 'battleship', name: 'Tàu Chiến', size: 4 },
  { id: 'cruiser', name: 'Tàu Tuần Dương', size: 3 },
  { id: 'submarine', name: 'Tàu Ngầm', size: 3 },
  { id: 'destroyer', name: 'Tàu Khu Trục', size: 2 },
];

export const createEmptyBoard = () => {
  return Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null));
};

// Check if a ship can be placed at (x, y) with a given direction
export const canPlaceShip = (board, x, y, size, isVertical) => {
  if (isVertical) {
    if (y + size > BOARD_SIZE) return false;
    for (let i = 0; i < size; i++) {
      if (board[y + i][x] !== null) return false;
    }
  } else {
    if (x + size > BOARD_SIZE) return false;
    for (let i = 0; i < size; i++) {
      if (board[y][x + i] !== null) return false;
    }
  }
  return true;
};

// Place a ship on the board (mutates board for performance)
export const placeShip = (board, x, y, size, isVertical, shipId) => {
  const positions = [];
  if (isVertical) {
    for (let i = 0; i < size; i++) {
      board[y + i][x] = shipId;
      positions.push({ x, y: y + i, hit: false });
    }
  } else {
    for (let i = 0; i < size; i++) {
      board[y][x + i] = shipId;
      positions.push({ x: x + i, y, hit: false });
    }
  }
  return positions;
};

// Generate a random board for bot
export const generateRandomBoard = () => {
  const board = createEmptyBoard();
  const placedShips = [];

  for (const ship of SHIPS) {
    let placed = false;
    while (!placed) {
      const isVertical = Math.random() > 0.5;
      const x = Math.floor(Math.random() * BOARD_SIZE);
      const y = Math.floor(Math.random() * BOARD_SIZE);

      if (canPlaceShip(board, x, y, ship.size, isVertical)) {
        const positions = placeShip(board, x, y, ship.size, isVertical, ship.id);
        placedShips.push({ id: ship.id, positions });
        placed = true;
      }
    }
  }

  return { board, placedShips };
};

export const checkWin = (ships) => {
  return ships.every(ship => ship.positions.every(p => p.hit));
};
