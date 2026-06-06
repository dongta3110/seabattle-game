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
  shipsData = [],
  salvoTargets = []
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

      const realStyle = {
        position: 'absolute',
        top: `calc(var(--cell-size) * ${startY} + 2px * ${startY} + 2px)`,
        left: `calc(var(--cell-size) * ${startX} + 2px * ${startX} + 2px)`,
        width: isVert ? 'var(--cell-size)' : `calc(var(--cell-size) * ${size} + 2px * ${size - 1})`,
        height: isVert ? `calc(var(--cell-size) * ${size} + 2px * ${size - 1})` : 'var(--cell-size)',
        pointerEvents: 'none',
        zIndex: 10,
        opacity: isSunk ? 0.5 : 1,
        transition: 'all 0.3s'
      };

      return (
        <div key={ship.id} style={realStyle}>
          <ShipOverlay shipId={ship.id} size={size} isVert={isVert} />
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
            const isSalvoTarget = salvoTargets.some(t => t.x === x && t.y === y);

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
              >
                {isSalvoTarget && (
                  <div style={{
                    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none'
                  }}>
                    <div style={{
                      width: '60%', height: '60%',
                      border: '2px solid var(--color-alert-red)',
                      borderRadius: '50%',
                      position: 'relative',
                      boxShadow: '0 0 5px var(--color-alert-red)'
                    }}>
                      <div style={{ position: 'absolute', top: '50%', left: '-20%', right: '-20%', height: '2px', background: 'var(--color-alert-red)', transform: 'translateY(-50%)' }}></div>
                      <div style={{ position: 'absolute', left: '50%', top: '-20%', bottom: '-20%', width: '2px', background: 'var(--color-alert-red)', transform: 'translateX(-50%)' }}></div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
