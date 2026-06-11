import { useState } from 'react';
import Board from './Board';
import ShipOverlay from './ShipOverlay';
import { SHIPS, createEmptyBoard, canPlaceShip, placeShip, generateRandomBoard } from '../utils/gameLogic';

export default function ShipSetup({ playerBoard, setPlayerBoard, playerShips, setPlayerShips, onReady, shipDefinitions = SHIPS }) {
  const [selectedShipId, setSelectedShipId] = useState(null);
  const [isVertical, setIsVertical] = useState(false);
  const [draggingShipId, setDraggingShipId] = useState(null);

  // Lọc ra các tàu chưa được đặt
  const availableShips = shipDefinitions.filter(s => !playerShips.find(ps => ps.id === s.id));
  
  // The ship currently selected or being dragged
  const activeShipId = draggingShipId || selectedShipId;
  const activeShip = shipDefinitions.find(s => s.id === activeShipId);

  const handleCellClick = (x, y) => {
    const cellState = playerBoard[y][x];
    if (cellState !== null && cellState !== 'hit' && cellState !== 'miss') {
      // Bấm vào tàu đã đặt trên bàn cờ -> Xoay tàu
      rotateShipOnBoard(cellState);
      return;
    }

    // Nếu đang chọn một tàu từ kho và click vào bàn cờ -> Đặt tàu
    if (selectedShipId && !draggingShipId) {
      attemptPlaceShip(selectedShipId, x, y, isVertical);
    }
  };

  const attemptPlaceShip = (shipId, x, y, vertical) => {
    const ship = shipDefinitions.find(s => s.id === shipId);
    if (!ship) return false;

    // Nếu tàu này đã có trên bàn cờ, ta nhấc nó lên trước
    const newBoard = [...playerBoard.map(row => [...row])];
    const existingShipIndex = playerShips.findIndex(s => s.id === shipId);
    if (existingShipIndex !== -1) {
      const existingShip = playerShips[existingShipIndex];
      existingShip.positions.forEach(p => { newBoard[p.y][p.x] = null; });
    }

    if (canPlaceShip(newBoard, x, y, ship.size, vertical)) {
      const positions = placeShip(newBoard, x, y, ship.size, vertical, shipId);
      setPlayerBoard(newBoard);
      
      if (existingShipIndex !== -1) {
        const newShips = [...playerShips];
        newShips[existingShipIndex] = { id: shipId, positions };
        setPlayerShips(newShips);
      } else {
        setPlayerShips([...playerShips, { id: shipId, positions }]);
      }
      setSelectedShipId(null);
      setDraggingShipId(null);
      return true;
    }
    return false;
  };

  const rotateShipOnBoard = (shipId) => {
    const shipIndex = playerShips.findIndex(s => s.id === shipId);
    if (shipIndex === -1) return;
    const shipData = playerShips[shipIndex];
    const size = shipData.positions.length;
    
    // Tìm tọa độ bắt đầu và hướng hiện tại
    const startX = Math.min(...shipData.positions.map(p => p.x));
    const startY = Math.min(...shipData.positions.map(p => p.y));
    const currentIsVert = size > 1 ? (shipData.positions[0].x === shipData.positions[1].x) : false;
    const newIsVert = !currentIsVert;
    
    // Adjust startX and startY to fit within bounds after rotation
    let adjustedX = startX;
    let adjustedY = startY;

    if (newIsVert) {
      if (adjustedY + size > 10) {
        adjustedY = 10 - size;
      }
    } else {
      if (adjustedX + size > 10) {
        adjustedX = 10 - size;
      }
    }
    
    // Thử đặt lại với hướng mới
    attemptPlaceShip(shipId, adjustedX, adjustedY, newIsVert);
  };

  const clearBoard = () => {
    setPlayerBoard(createEmptyBoard());
    setPlayerShips([]);
    setSelectedShipId(null);
  };

  const randomize = () => {
    const { board, placedShips } = generateRandomBoard(shipDefinitions);
    setPlayerBoard(board);
    setPlayerShips(placedShips);
    setSelectedShipId(null);
  };

  const handleDragStartArmory = (e, shipId) => {
    setDraggingShipId(shipId);
    setSelectedShipId(shipId);
    e.dataTransfer.setData('shipId', shipId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragStartBoard = (x, y, e) => {
    const shipId = playerBoard[y][x];
    if (shipId) {
      const shipData = playerShips.find(s => s.id === shipId);
      if (shipData) {
        const size = shipData.positions.length;
        const currentIsVert = size > 1 ? (shipData.positions[0].x === shipData.positions[1].x) : false;
        setIsVertical(currentIsVert);
        setDraggingShipId(shipId);
        e.dataTransfer.setData('shipId', shipId);
        e.dataTransfer.effectAllowed = 'move';
      }
    } else {
      e.preventDefault();
    }
  };

  const handleDropOnBoard = (x, y, e) => {
    const shipId = e.dataTransfer.getData('shipId');
    if (shipId) {
      attemptPlaceShip(shipId, x, y, isVertical);
    }
    setDraggingShipId(null);
  };

  const groupedShips = [];
  const counts = {};
  availableShips.forEach(s => {
    if (!counts[s.name]) counts[s.name] = [];
    counts[s.name].push(s);
  });
  
  Object.keys(counts).forEach(name => {
    const ships = counts[name];
    groupedShips.push({
      ...ships[0],
      displayName: ships.length > 1 ? `${name} x${ships.length}` : name
    });
  });

  return (
    <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', justifyContent: 'center', userSelect: 'none' }}>
      <div className="panel" style={{ width: '300px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <h3 style={{ color: 'var(--color-steel-light)', textAlign: 'center' }}>KHO VŨ KHÍ</h3>
        
        {availableShips.length > 0 ? (
          <>
            <div style={{ display: 'flex', flexDirection: isVertical ? 'row' : 'column', gap: '1rem', flexWrap: 'wrap' }}>
              {groupedShips.map(ship => (
                <div key={ship.id} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div 
                    className={`draggable-ship ${selectedShipId === ship.id ? 'selected' : ''}`}
                    draggable
                    onDragStart={(e) => handleDragStartArmory(e, ship.id)}
                    onDragEnd={() => setDraggingShipId(null)}
                    onClick={() => {
                      if (selectedShipId === ship.id) {
                        setIsVertical(!isVertical);
                      } else {
                        setSelectedShipId(ship.id);
                      }
                    }}
                    style={{
                      position: 'relative',
                      width: isVertical ? 'var(--cell-size)' : `calc(var(--cell-size) * ${ship.size} + 2px * ${ship.size - 1})`,
                      height: isVertical ? `calc(var(--cell-size) * ${ship.size} + 2px * ${ship.size - 1})` : 'var(--cell-size)',
                      border: selectedShipId === ship.id ? '2px solid var(--color-radar-green)' : '2px solid var(--color-steel)',
                      boxShadow: selectedShipId === ship.id ? '0 0 10px var(--color-radar-green)' : 'none',
                      display: 'flex',
                      flexDirection: isVertical ? 'column' : 'row',
                      gap: '2px',
                    }}
                  >
                    <div style={{
                      position: 'absolute',
                      top: 0, left: 0, right: 0, bottom: 0,
                      pointerEvents: 'none'
                    }}>
                      <ShipOverlay shipId={ship.id} size={ship.size} isVert={isVertical} />
                    </div>
                    {Array.from({ length: ship.size }).map((_, i) => (
                      <div key={i} className="cell ship" style={{ width: 'var(--cell-size)', height: 'var(--cell-size)', opacity: 0 }}></div>
                    ))}
                  </div>
                  <span style={{ fontSize: '0.9rem', color: 'white' }}>{ship.displayName}</span>
                </div>
              ))}
            </div>
            
          </>
        ) : (
          <div style={{ color: 'var(--color-radar-green)', textAlign: 'center', padding: '1rem 0' }}>
            Hạm đội đã sẵn sàng! (Bạn có thể bấm vào tàu trên bản đồ để xoay hoặc kéo để di chuyển)
          </div>
        )}

        <hr style={{ borderColor: 'var(--color-steel)', margin: '1rem 0' }} />
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <button className="btn" onClick={randomize}>Xếp ngẫu nhiên</button>
          <button className="btn" onClick={clearBoard}>Xóa bàn cờ</button>
          {availableShips.length === 0 && (
            <button className="btn btn-primary" style={{ marginTop: '1rem' }} onClick={onReady}>
              XÁC NHẬN SẴN SÀNG
            </button>
          )}
        </div>
      </div>

      <div>
         <Board 
           title="HẠM ĐỘI CỦA BẠN" 
           grid={playerBoard} 
           hideShips={false} 
           interactive={true}
           onCellClick={handleCellClick} 
           previewShip={activeShip}
           isVertical={isVertical}
           onDragStartCell={handleDragStartBoard}
           onDropOnCell={handleDropOnBoard}
           onDragEndCell={() => setDraggingShipId(null)}
           shipsData={playerShips}
         />
      </div>
    </div>
  );
}
