import { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { names, encouragements } from '../data/names';

interface HexPos {
  q: number;
  r: number;
  dist: number;
  idx: number;
  delay: number;
}

interface ParticleData {
  id: number;
  tx: number;
  ty: number;
  color: string;
  size: number;
}

interface EncData {
  id: number;
  text: string;
}

// Cubic coordinates helper to generate standard point-topped hexagonal honeycomb.
// Exclusion zone: dist <= 2 is reserved for the large central hexagon.
function generateStrictHexPositions(count: number): HexPos[] {
  const positions: HexPos[] = [];
  const maxRing = 12;
  const temp: { q: number; r: number; dist: number; angle: number }[] = [];

  for (let q = -maxRing; q <= maxRing; q++) {
    for (let r = -maxRing; r <= maxRing; r++) {
      const s = -q - r;
      if (Math.abs(s) <= maxRing) {
        const dist = Math.max(Math.abs(q), Math.abs(r), Math.abs(s));
        // Skip ring 0, 1, 2 to reserve space for the central hexagon
        if (dist <= 2) continue;

        // Angle in radians for ripple order
        const angle = Math.atan2(r + q * 0.5, q * Math.sqrt(3) / 2);
        temp.push({ q, r, dist, angle });
      }
    }
  }

  // Sort primarily by ring distance, secondarily by radial angle for a beautiful ripple intro
  temp.sort((a, b) => {
    if (a.dist !== b.dist) return a.dist - b.dist;
    return a.angle - b.angle;
  });

  const selected = temp.slice(0, count);
  selected.forEach((p, i) => {
    const ringCount = p.dist * 6;
    const ringIdx = selected.filter(s => s.dist === p.dist).indexOf(p);
    const delay = p.dist * 0.06 + (ringIdx / Math.max(1, ringCount)) * 0.05;
    positions.push({ q: p.q, r: p.r, dist: p.dist, idx: i, delay: Math.min(delay, 2.5) });
  });

  return positions;
}

export default function HoneycombGrid() {
  const [isMobileState, setIsMobileState] = useState(window.innerWidth < 768);
  const isMobile = isMobileState;

  // Exact math for Regular Pointy-topped hexagon:
  // Radius R (center to vertex), Width W (flat to flat horizontally), Height H (vertex to vertex vertically).
  // W = sqrt(3) * R, H = 2 * R.
  // Horiz spacing: W = sqrt(3) * R.
  // Vert spacing: 1.5 * R.
  const rSize = isMobile ? 45 : window.innerWidth < 1400 ? 58 : 64;
  const hexWidth = Math.sqrt(3) * rSize;
  const hexHeight = 2 * rSize;

  const hexPositions = useMemo(() => generateStrictHexPositions(names.length), []);

  const containerRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  // Offset & Zoom state refs
  const offsetRef = useRef({ x: 0, y: 0, vx: 0, vy: 0 });
  const scaleRef = useRef(isMobile ? 0.65 : window.innerWidth < 1200 ? 0.8 : 0.95);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0, ox: 0, oy: 0 });
  const lastMouseRef = useRef({ x: 0, y: 0, time: 0 });
  const velocityRef = useRef({ x: 0, y: 0 });
  const hoveredRef = useRef<number | null>(null);
  const touchStartRef = useRef({ x: 0, y: 0, time: 0 });

  const [hovered, setHovered] = useState<number | null>(null);
  const [focused, setFocused] = useState<number | null>(null);
  const [particles, setParticles] = useState<{ id: number; x: number; y: number; data: ParticleData }[]>([]);
  const [encouragementsShown, setEncouragementsShown] = useState<{ id: number; x: number; y: number; data: EncData }[]>([]);
  const [introDone, setIntroDone] = useState(false);
  const [easterEgg, setEasterEgg] = useState(false);
  const [, setRenderTick] = useState(0);

  const centerClicksRef = useRef<number[]>([]);
  const particleIdRef = useRef(0);
  const encIdRef = useRef(0);
  const rafRef = useRef(0);
  const introStartRef = useRef(0);

  // Convert Axial Coordinates (q, r) into strict world (X, Y) pixel positions
  const getHexWorldPos = useCallback((q: number, r: number) => {
    return {
      x: rSize * Math.sqrt(3) * (q + r / 2),
      y: rSize * 1.5 * r,
    };
  }, [rSize]);

  // Screen to world translation
  const screenToWorld = useCallback((sx: number, sy: number) => {
    const s = scaleRef.current;
    const ox = offsetRef.current.x;
    const oy = offsetRef.current.y;
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    return {
      x: (sx - cx) / s - ox,
      y: (sy - cy) / s - oy,
    };
  }, []);

  useEffect(() => {
    const onResize = () => setIsMobileState(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Physics animation loop
  useEffect(() => {
    introStartRef.current = performance.now();

    function animate() {
      const now = performance.now();
      const introElapsed = (now - introStartRef.current) / 1000;
      if (!introDone && introElapsed > 3.2) {
        setIntroDone(true);
      }

      const off = offsetRef.current;
      if (!isDraggingRef.current) {
        // Soft elastic spring back to center
        off.vx += (0 - off.x) * 0.025;
        off.vy += (0 - off.y) * 0.025;
        // Apply friction damping
        off.vx *= 0.94;
        off.vy *= 0.94;
        off.x += off.vx;
        off.y += off.vy;
      } else {
        // Add momentum
        off.x += velocityRef.current.x;
        off.y += velocityRef.current.y;
        velocityRef.current.x *= 0.85;
        velocityRef.current.y *= 0.85;
      }

      // Apply transform updates straight to the DOM for max performance
      if (gridRef.current) {
        const s = scaleRef.current;
        gridRef.current.style.transform = `translate(${off.x}px, ${off.y}px) scale(${s})`;
      }

      setRenderTick(t => t + 1);
      rafRef.current = requestAnimationFrame(animate);
    }

    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [introDone]);

  // Handle Dragging
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    isDraggingRef.current = true;
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      ox: offsetRef.current.x,
      oy: offsetRef.current.y,
    };
    lastMouseRef.current = { x: e.clientX, y: e.clientY, time: performance.now() };
    velocityRef.current = { x: 0, y: 0 };
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDraggingRef.current) {
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      offsetRef.current.x = dragStartRef.current.ox + dx / scaleRef.current;
      offsetRef.current.y = dragStartRef.current.oy + dy / scaleRef.current;

      const now = performance.now();
      const dt = now - lastMouseRef.current.time;
      if (dt > 0) {
        velocityRef.current = {
          x: (e.clientX - lastMouseRef.current.x) / dt * 16,
          y: (e.clientY - lastMouseRef.current.y) / dt * 16,
        };
      }
      lastMouseRef.current = { x: e.clientX, y: e.clientY, time: now };
    }
  }, []);

  const handleMouseUp = useCallback(() => {
    isDraggingRef.current = false;
  }, []);

  // Handlers for mobile touch
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const t = e.touches[0];
    touchStartRef.current = { x: t.clientX, y: t.clientY, time: performance.now() };
    isDraggingRef.current = true;
    dragStartRef.current = {
      x: t.clientX,
      y: t.clientY,
      ox: offsetRef.current.x,
      oy: offsetRef.current.y,
    };
    lastMouseRef.current = { x: t.clientX, y: t.clientY, time: performance.now() };
    velocityRef.current = { x: 0, y: 0 };
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDraggingRef.current) return;
    const t = e.touches[0];
    const dx = t.clientX - dragStartRef.current.x;
    const dy = t.clientY - dragStartRef.current.y;
    offsetRef.current.x = dragStartRef.current.ox + dx / scaleRef.current;
    offsetRef.current.y = dragStartRef.current.oy + dy / scaleRef.current;

    const now = performance.now();
    const dt = now - lastMouseRef.current.time;
    if (dt > 0) {
      velocityRef.current = {
        x: (t.clientX - lastMouseRef.current.x) / dt * 16,
        y: (t.clientY - lastMouseRef.current.y) / dt * 16,
      };
    }
    lastMouseRef.current = { x: t.clientX, y: t.clientY, time: now };
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    isDraggingRef.current = false;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStartRef.current.x;
    const dy = t.clientY - touchStartRef.current.y;
    const dt = performance.now() - touchStartRef.current.time;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 15 && dt < 300) {
      const world = screenToWorld(t.clientX, t.clientY);
      let bestIdx = -1;
      let bestDist = Infinity;

      hexPositions.forEach((pos, i) => {
        const hp = getHexWorldPos(pos.q, pos.r);
        const d = Math.sqrt((world.x - hp.x) ** 2 + (world.y - hp.y) ** 2);
        if (d < bestDist && d < hexWidth * 0.6) {
          bestDist = d;
          bestIdx = i;
        }
      });

      if (bestIdx >= 0) {
        handleHexClick(bestIdx, t.clientX, t.clientY);
        setFocused(bestIdx);
        setTimeout(() => setFocused(null), 2000);
      }
    }
  }, [hexPositions, screenToWorld, getHexWorldPos, hexWidth]);

  // Zoom center scaling
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const oldScale = scaleRef.current;
    const delta = e.deltaY > 0 ? -0.06 : 0.06;
    const newScale = Math.max(0.4, Math.min(2.0, oldScale + delta));

    if (newScale !== oldScale) {
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        const mx = e.clientX - rect.left - rect.width / 2;
        const my = e.clientY - rect.top - rect.height / 2;
        const off = offsetRef.current;
        off.x = off.x - mx * (newScale - oldScale) / (oldScale * newScale);
        off.y = off.y - my * (newScale - oldScale) / (oldScale * newScale);
      }
      scaleRef.current = newScale;
    }
  }, []);

  const handleHexClick = useCallback((_idx: number, sx: number, sy: number) => {
    const colors = ['#d4af77', '#e8c4a0', '#f5d4a0', '#ffd700', '#c9a86c'];
    const newParticles: { id: number; x: number; y: number; data: ParticleData }[] = [];
    const count = isMobile ? 25 : 40;
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
      const speed = Math.random() * 80 + 40;
      newParticles.push({
        id: particleIdRef.current++,
        x: sx,
        y: sy,
        data: {
          id: particleIdRef.current,
          tx: Math.cos(angle) * speed,
          ty: Math.sin(angle) * speed - 30,
          color: colors[Math.floor(Math.random() * colors.length)],
          size: Math.random() * 4 + 2,
        },
      });
    }
    setParticles(prev => [...prev, ...newParticles]);
    setTimeout(() => {
      setParticles(prev => prev.filter(p => !newParticles.find(np => np.id === p.id)));
    }, 1500);

    const encText = encouragements[Math.floor(Math.random() * encouragements.length)];
    const encId = encIdRef.current++;
    setEncouragementsShown(prev => [...prev, { id: encId, x: sx, y: sy - 20, data: { id: encId, text: encText } }]);
    setTimeout(() => {
      setEncouragementsShown(prev => prev.filter(e => e.id !== encId));
    }, 2600);
  }, [isMobile]);

  const handleCenterClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const now = performance.now();
    centerClicksRef.current = centerClicksRef.current.filter(t => now - t < 2000);
    centerClicksRef.current.push(now);

    if (centerClicksRef.current.length >= 3) {
      centerClicksRef.current = [];
      setEasterEgg(true);
      if ((window as any).triggerBigFireworks) {
        (window as any).triggerBigFireworks();
      }
      setTimeout(() => setEasterEgg(false), 5000);
    }
    handleHexClick(-1, e.clientX, e.clientY);
  }, [handleHexClick]);

  const handleHexMouseEnter = useCallback((idx: number) => {
    hoveredRef.current = idx;
    setHovered(idx);
  }, []);

  const handleHexMouseLeave = useCallback(() => {
    hoveredRef.current = null;
    setHovered(null);
  }, []);

  const getHexBrightness = useCallback((idx: number) => {
    const h = hoveredRef.current;
    if (h === null) return 1;
    if (h === idx) return 1;
    const pos1 = hexPositions[idx];
    const pos2 = hexPositions[h];
    const p1 = getHexWorldPos(pos1.q, pos1.r);
    const p2 = getHexWorldPos(pos2.q, pos2.r);
    const dist = Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);
    const maxDist = hexWidth * 4;
    return 0.45 + 0.55 * Math.min(1, dist / maxDist);
  }, [hexPositions, getHexWorldPos, hexWidth]);

  const getHexScale = useCallback((idx: number) => {
    const h = hoveredRef.current;
    if (h === null) return 1;
    if (h === idx) return 1;
    const pos1 = hexPositions[idx];
    const pos2 = hexPositions[h];
    const p1 = getHexWorldPos(pos1.q, pos1.r);
    const p2 = getHexWorldPos(pos2.q, pos2.r);
    const dist = Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);
    const maxDist = hexWidth * 4;
    return 0.9 + 0.1 * Math.min(1, dist / maxDist);
  }, [hexPositions, getHexWorldPos, hexWidth]);

  // Center hex coverage parameters
  const centerWidth = Math.sqrt(3) * (rSize * 2.6);
  const centerHeight = 2 * (rSize * 2.6);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 overflow-hidden cursor-grab active:cursor-grabbing"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onWheel={handleWheel}
      style={{ touchAction: 'none' }}
    >
      {/* Container */}
      <div
        ref={gridRef}
        className="absolute will-change-transform"
        style={{
          left: '50%',
          top: '50%',
          width: 0,
          height: 0,
          transform: `translate(0px, 0px) scale(${scaleRef.current})`,
        }}
      >
        {/* Render Name Hexagons */}
        {hexPositions.map((pos, i) => {
          const wp = getHexWorldPos(pos.q, pos.r);
          const isHovered = hovered === i;
          const isFocused = focused === i;
          const brightness = getHexBrightness(i);
          const scale = getHexScale(i);
          const showHover = isHovered || isFocused;

          return (
            <div
              key={i}
              className="absolute no-select will-change-transform"
              style={{
                left: wp.x - hexWidth / 2,
                top: wp.y - hexHeight / 2,
                width: hexWidth,
                height: hexHeight,
                opacity: 0,
                animation: `fadeInUp 0.6s ease-out ${pos.delay}s forwards`,
                filter: showHover ? 'none' : `brightness(${brightness})`,
                transform: `scale(${showHover ? 1.15 : scale}) translateY(${showHover ? -4 : 0}px)`,
                transition: 'transform 0.3s ease-out, filter 0.4s ease, opacity 0.5s ease',
                zIndex: showHover ? 50 : 1,
              }}
              onMouseEnter={() => handleHexMouseEnter(i)}
              onMouseLeave={handleHexMouseLeave}
              onClick={(e) => {
                e.stopPropagation();
                handleHexClick(i, e.clientX, e.clientY);
              }}
            >
              <div
                className="hexagon-clip absolute inset-0 flex flex-col items-center justify-center"
                style={{
                  background: showHover
                    ? 'rgba(27, 58, 92, 0.7)'
                    : 'rgba(27, 58, 92, 0.4)',
                  backdropFilter: 'blur(12px)',
                  WebkitBackdropFilter: 'blur(12px)',
                  boxShadow: showHover
                    ? 'inset 0 0 30px rgba(212,175,119,0.25), 0 0 30px rgba(212,175,119,0.55), 0 4px 20px rgba(0,0,0,0.45)'
                    : 'inset 0 0 20px rgba(212,175,119,0.08), 0 4px 20px rgba(0,0,0,0.3)',
                  border: showHover
                    ? '2px solid rgba(212,175,119,0.85)'
                    : '1px solid rgba(212,175,119,0.3)',
                  transition: 'all 0.3s ease-out',
                  animation: `float ${3.5 + (pos.idx % 5) * 0.4}s ease-in-out infinite`,
                  animationDelay: `${pos.delay * 2 + 0.8}s`,
                }}
              >
                <span
                  className="text-center px-1"
                  style={{
                    fontSize: isMobile ? '12px' : '15px',
                    fontWeight: 600,
                    letterSpacing: '0.05em',
                    color: showHover ? '#d4af77' : '#f5f5f7',
                    textShadow: '0 2px 8px rgba(0,0,0,0.5)',
                    transition: 'color 0.3s ease',
                    lineHeight: 1.3,
                    wordBreak: 'keep-all',
                  }}
                >
                  {names[i]}
                </span>
                <div
                  style={{
                    width: '60%',
                    height: '1px',
                    background: showHover
                      ? 'rgba(212,175,119,0.6)'
                      : 'rgba(212,175,119,0.22)',
                    marginTop: '3px',
                    transition: 'background 0.3s ease',
                    boxShadow: showHover ? '0 0 6px rgba(212,175,119,0.4)' : 'none',
                  }}
                />
              </div>
            </div>
          );
        })}

        {/* Center Golden Glowing aura */}
        <div
          className="absolute pointer-events-none"
          style={{
            left: -centerWidth * 0.6,
            top: -centerHeight * 0.6,
            width: centerWidth * 1.2,
            height: centerHeight * 1.2,
            zIndex: 99,
            opacity: 0,
            animation: `fadeInUp 1s ease-out 0.3s forwards, pulse-glow 4s ease-in-out infinite`,
            animationDelay: `0.3s, 2s`,
          }}
        >
          <div
            className="hexagon-clip absolute inset-0"
            style={{
              background: 'radial-gradient(ellipse at center, rgba(212,175,119,0.2) 0%, transparent 70%)',
            }}
          />
        </div>

        {/* Central blessing hexagon */}
        <div
          className="absolute no-select will-change-transform"
          style={{
            left: -centerWidth / 2,
            top: -centerHeight / 2,
            width: centerWidth,
            height: centerHeight,
            zIndex: 100,
            opacity: 0,
            animation: `fadeInUp 0.8s ease-out 0.5s forwards`,
          }}
          onClick={handleCenterClick}
        >
          <div
            className="hexagon-clip absolute inset-0 flex flex-col items-center justify-center"
            style={{
              background: 'rgba(27, 58, 92, 0.6)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              boxShadow: 'inset 0 0 45px rgba(212,175,119,0.2), 0 0 50px rgba(212,175,119,0.4), 0 8px 40px rgba(0,0,0,0.5)',
              border: '2px solid transparent',
              backgroundClip: 'padding-box',
              cursor: 'pointer',
            }}
          >
            {/* Edge shimmer for central hex */}
            <div
              className="hexagon-clip absolute inset-0 pointer-events-none"
              style={{
                padding: '2px',
                background: 'linear-gradient(135deg, #d4af77, #e8c4a0, #d4af77, #c9a86c)',
                backgroundSize: '300% 300%',
                animation: 'shimmer 4s ease infinite',
                WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
                WebkitMaskComposite: 'xor',
                maskComposite: 'exclude',
              }}
            />
            <span
              className="text-center px-4"
              style={{
                fontSize: isMobile ? '18px' : '26px',
                fontWeight: 700,
                letterSpacing: '0.15em',
                lineHeight: 1.6,
                background: 'linear-gradient(180deg, #e8c4a0, #d4af77)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                textShadow: 'none',
                filter: 'drop-shadow(0 2px 10px rgba(212,175,119,0.35))',
              }}
            >
              祝学弟学妹们
              <br />
              高考加油！
            </span>
            <div
              style={{
                width: '45%',
                height: '2px',
                background: 'linear-gradient(90deg, transparent, #d4af77, transparent)',
                marginTop: '12px',
                opacity: 0.65,
              }}
            />
          </div>
        </div>
      </div>

      {/* Particle Effects */}
      {particles.map(p => (
        <div
          key={p.id}
          className="fixed pointer-events-none"
          style={{
            left: p.x,
            top: p.y,
            width: p.data.size,
            height: p.data.size,
            borderRadius: '50%',
            background: p.data.color,
            boxShadow: `0 0 ${p.data.size * 2}px ${p.data.color}`,
            '--tx': `${p.data.tx}px`,
            '--ty': `${p.data.ty}px`,
            animation: 'particleBurst 1.2s ease-out forwards',
            zIndex: 200,
          } as React.CSSProperties}
        />
      ))}

      {/* Encouragement text popups */}
      {encouragementsShown.map(e => (
        <div
          key={e.id}
          className="fixed pointer-events-none text-center"
          style={{
            left: e.x,
            top: e.y,
            transform: 'translateX(-50%)',
            fontSize: isMobile ? '16px' : '22px',
            fontWeight: 700,
            color: '#d4af77',
            letterSpacing: '0.1em',
            textShadow: '0 0 20px rgba(212,175,119,0.6), 0 2px 8px rgba(0,0,0,0.8)',
            animation: 'encouragementFloat 2.5s ease-out forwards',
            zIndex: 200,
            whiteSpace: 'nowrap',
          }}
        >
          {e.data.text}
        </div>
      ))}

      {/* Full-screen big easter egg text */}
      {easterEgg && (
        <div
          className="fixed inset-0 flex items-center justify-center pointer-events-none"
          style={{ zIndex: 300 }}
        >
          <div
            className="text-center px-8"
            style={{
              animation: 'easterEggText 4.5s ease-out forwards',
            }}
          >
            <div
              style={{
                fontSize: isMobile ? '24px' : '44px',
                fontWeight: 900,
                color: '#d4af77',
                letterSpacing: '0.22em',
                lineHeight: 1.8,
                textShadow: '0 0 45px rgba(212,175,119,0.6), 0 4px 20px rgba(0,0,0,0.85)',
              }}
            >
              百舸争流，创发争优！
              <br />
              破浪行舟，挥斥方遒！
            </div>
          </div>
        </div>
      )}

      {/* Geometry designs in the corners */}
      <div className="fixed top-6 left-6 pointer-events-none" style={{ zIndex: 5, opacity: 0.07 }}>
        <svg width="60" height="60" viewBox="0 0 60 60">
          <polygon points="30,0 60,15 60,45 30,60 0,45 0,15" fill="none" stroke="#d4af77" strokeWidth="1" />
          <polygon points="30,10 50,20 50,40 30,50 10,40 10,20" fill="none" stroke="#d4af77" strokeWidth="0.5" />
        </svg>
      </div>
      <div className="fixed top-6 right-6 pointer-events-none" style={{ zIndex: 5, opacity: 0.07 }}>
        <svg width="60" height="60" viewBox="0 0 60 60">
          <polygon points="30,0 60,15 60,45 30,60 0,45 0,15" fill="none" stroke="#d4af77" strokeWidth="1" />
          <polygon points="30,10 50,20 50,40 30,50 10,40 10,20" fill="none" stroke="#d4af77" strokeWidth="0.5" />
        </svg>
      </div>
      <div className="fixed bottom-16 left-6 pointer-events-none" style={{ zIndex: 5, opacity: 0.07 }}>
        <svg width="60" height="60" viewBox="0 0 60 60">
          <polygon points="30,0 60,15 60,45 30,60 0,45 0,15" fill="none" stroke="#d4af77" strokeWidth="1" />
          <polygon points="30,10 50,20 50,40 30,50 10,40 10,20" fill="none" stroke="#d4af77" strokeWidth="0.5" />
        </svg>
      </div>
      <div className="fixed bottom-16 right-6 pointer-events-none" style={{ zIndex: 5, opacity: 0.07 }}>
        <svg width="60" height="60" viewBox="0 0 60 60">
          <polygon points="30,0 60,15 60,45 30,60 0,45 0,15" fill="none" stroke="#d4af77" strokeWidth="1" />
          <polygon points="30,10 50,20 50,40 30,50 10,40 10,20" fill="none" stroke="#d4af77" strokeWidth="0.5" />
        </svg>
      </div>
    </div>
  );
}
