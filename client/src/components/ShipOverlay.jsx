export default function ShipOverlay({ shipId, size, isVert, widthPx, lengthPx }) {
  const isCarrier = shipId === 'carrier';
  const isSub = shipId === 'submarine';

  const hullColor = isSub ? '#0a0a0a' : '#141414';
  const borderColor = '#2a2a2a';
  const superstructureColor = '#242424';

  return (
    <div style={{
      width: '100%',
      height: '100%',
      backgroundColor: hullColor,
      border: `2px solid ${borderColor}`,
      borderRadius: isVert ? '40% 40% 10% 10%' : '10% 40% 40% 10%',
      position: 'relative',
      boxShadow: 'inset 0 0 10px rgba(0,0,0,0.8), 0 4px 6px rgba(0,0,0,0.5)',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: isVert ? 'column' : 'row',
      alignItems: 'center',
      justifyContent: 'space-evenly'
    }}>
      {/* Tactical grid lines for deck instead of wood */}
      {!isSub && (
        <div style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundImage: isVert 
            ? 'repeating-linear-gradient(90deg, transparent, transparent 8px, rgba(255,255,255,0.03) 8px, rgba(255,255,255,0.03) 10px)'
            : 'repeating-linear-gradient(0deg, transparent, transparent 8px, rgba(255,255,255,0.03) 8px, rgba(255,255,255,0.03) 10px)',
          pointerEvents: 'none'
        }}></div>
      )}

      {/* Runway for Carrier - Tactical Red */}
      {isCarrier && (
        <div style={{
          position: 'absolute',
          top: isVert ? '10%' : '50%',
          left: isVert ? '50%' : '10%',
          width: isVert ? '4px' : '80%',
          height: isVert ? '80%' : '4px',
          background: 'repeating-linear-gradient(' + (isVert ? '0deg' : '90deg') + ', #8b0000, #8b0000 10px, transparent 10px, transparent 20px)',
          transform: isVert ? 'translateX(-50%)' : 'translateY(-50%)',
          zIndex: 1
        }}></div>
      )}

      {/* Superstructure & Cannons */}
      {!isCarrier && !isSub && (
        <>
          <div style={{
            width: isVert ? '20px' : '15px',
            height: isVert ? '15px' : '20px',
            background: superstructureColor,
            borderRadius: '50%',
            position: 'relative',
            boxShadow: '0 2px 4px rgba(0,0,0,0.8)',
            border: '1px solid #333'
          }}>
            <div style={{
              position: 'absolute',
              top: isVert ? '-10px' : '50%',
              left: isVert ? '50%' : '20px',
              width: isVert ? '4px' : '10px',
              height: isVert ? '10px' : '4px',
              background: '#444',
              transform: isVert ? 'translateX(-50%)' : 'translateY(-50%)'
            }}></div>
          </div>

          <div style={{
            width: isVert ? '24px' : '40px',
            height: isVert ? '40px' : '24px',
            background: superstructureColor,
            borderRadius: '4px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.8)',
            border: '1px solid #333',
            zIndex: 2
          }}></div>

          <div style={{
            width: isVert ? '20px' : '15px',
            height: isVert ? '15px' : '20px',
            background: superstructureColor,
            borderRadius: '50%',
            position: 'relative',
            boxShadow: '0 2px 4px rgba(0,0,0,0.8)',
            border: '1px solid #333'
          }}>
            <div style={{
              position: 'absolute',
              bottom: isVert ? '-10px' : 'auto',
              right: isVert ? 'auto' : '20px',
              top: isVert ? 'auto' : '50%',
              left: isVert ? '50%' : 'auto',
              width: isVert ? '4px' : '10px',
              height: isVert ? '10px' : '4px',
              background: '#444',
              transform: isVert ? 'translateX(-50%)' : 'translateY(-50%)'
            }}></div>
          </div>
        </>
      )}

      {/* Carrier island */}
      {isCarrier && (
        <div style={{
          position: 'absolute',
          right: isVert ? '2px' : 'auto',
          bottom: isVert ? 'auto' : '2px',
          top: isVert ? '30%' : 'auto',
          left: isVert ? 'auto' : '30%',
          width: isVert ? '10px' : '40px',
          height: isVert ? '40px' : '10px',
          background: superstructureColor,
          borderRadius: '2px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.5)',
          zIndex: 2
        }}></div>
      )}

      {/* Submarine details */}
      {isSub && (
        <div style={{
          width: isVert ? '12px' : '30px',
          height: isVert ? '30px' : '12px',
          background: '#1a252f',
          borderRadius: '6px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.5)'
        }}></div>
      )}

    </div>
  );
}
