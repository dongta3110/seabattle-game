import { useState } from 'react';
import { canPlaceShip } from '../utils/gameLogic';
import ShipOverlay from './ShipOverlay';

export default function Board({ 
  grid, 
  onCellClick, 
  hideShips, 
  title, 
  previewShip, 
  isVertical,
  onDragOverCell,
  onDropOnCell,
  onDragStartCell,
  onDragEndCell,
  onDragLeaveBoard,
  interactive,
  shipsData = []
}) {
  const [hoverX, setHoverX] = useState(null);
  const [hoverY, setHoverY] = useState(null);

  const getPreviewClasses = (x, y) => {
    if (!previewShip || hoverX === null || hoverY === null) return '';
    
    const isValid = canPlaceShip(grid, hoverX, hoverY, previewShip.size, isVertical);
    const inRange = isVertical 
      ? (x === hoverX && y >= hoverY && y < hoverY + previewShip.size)
      : (y === hoverY && x >= hoverX && x < hoverX + previewShip.size);

    if (inRange) {
      return isValid ? ' preview-valid' : ' preview-invalid';
    }
    return '';
  };

  const handleDragOver = (e, x, y) => {
    if (interactive) {
      e.preventDefault(); // allow drop
      setHoverX(x);
      setHoverY(y);
      if (onDragOverCell) onDragOverCell(x, y, e);
    }
  };

  const handleMouseLeave = () => {
    setHoverX(null);
    setHoverY(null);
    if (onDragLeaveBoard) onDragLeaveBoard();
  };

  const renderShipOverlays = () => {
    return shipsData.map((ship) => {
      if (!ship.positions || ship.positions.length === 0) return null;
      
      const isSunk = ship.positions.every(p => p.hit);
      if (hideShips && !isSunk) return null;

      const startX = Math.min(...ship.positions.map(p => p.x));
      const startY = Math.min(...ship.positions.map(p => p.y));
      const isVert = ship.positions.length > 1 ? ship.positions[0].x === ship.positions[1].x : false;
      const size = ship.positions.length;

      const cellW = 40;
      const gap = 2;
      const lengthPx = size * cellW + (size - 1) * gap;
      const widthPx = cellW;

      const realStyle = {
        position: 'absolute',
        top: `${startY * (cellW + gap) + gap}px`,
        left: `${startX * (cellW + gap) + gap}px`,
        width: isVert ? `${widthPx}px` : `${lengthPx}px`,
        height: isVert ? `${lengthPx}px` : `${widthPx}px`,
        pointerEvents: 'none',
        zIndex: 10,
        opacity: isSunk ? 0.5 : 1,
        transition: 'all 0.3s'
      };

      return (
        <div key={ship.id} style={realStyle}>
          <ShipOverlay shipId={ship.id} size={size} isVert={isVert} widthPx={widthPx} lengthPx={lengthPx} />
        </div>
      );
    });
  };

  return (
    <div className="board-wrapper">
      <h2 className="board-title">{title}</h2>
      <div 
        className="grid" 
        style={{ position: 'relative' }}
        onMouseLeave={handleMouseLeave}
        onDragLeave={handleMouseLeave}
      >
        {renderShipOverlays()}
        {grid.map((row, y) =>
          row.map((cellState, x) => {
            let classes = "cell";
            
            if (cellState === 'hit') classes += " hit";
            else if (cellState === 'miss') classes += " miss";
            else if (cellState === 'sunk') classes += " sunk";
            else if (cellState !== null && !hideShips) classes += " ship";
            
            classes += getPreviewClasses(x, y);

            const isShipCell = cellState !== null && cellState !== 'hit' && cellState !== 'miss' && cellState !== 'sunk' && !hideShips;

            return (
              <div
                key={`${y}-${x}`}
                className={classes}
                draggable={interactive && isShipCell}
                onDragStart={(e) => interactive && onDragStartCell && onDragStartCell(x, y, e)}
                onDragEnd={(e) => interactive && onDragEndCell && onDragEndCell(e)}
                onDragOver={(e) => handleDragOver(e, x, y)}
                onDrop={(e) => {
                  if (interactive && onDropOnCell) {
                    e.preventDefault();
                    setHoverX(null);
                    setHoverY(null);
                    onDropOnCell(x, y, e);
                  }
                }}
                onClick={() => onCellClick(x, y)}
                onMouseEnter={() => { if (interactive) { setHoverX(x); setHoverY(y); } }}
              ></div>
            );
          })
        )}
      </div>
    </div>
  );
}
