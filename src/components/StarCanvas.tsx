import { useEffect, useRef } from 'react';

interface Star {
  x: number;
  y: number;
  size: number;
  opacity: number;
  targetOpacity: number;
  twinkleSpeed: number;
  twinklePhase: number;
  layer: number;
}

interface Meteor {
  x: number;
  y: number;
  length: number;
  speed: number;
  angle: number;
  opacity: number;
  active: boolean;
  width: number;
}

interface Nebula {
  x: number;
  y: number;
  radius: number;
  color: string;
  opacity: number;
  phase: number;
  speed: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
}

export default function StarCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const starsRef = useRef<Star[]>([]);
  const meteorsRef = useRef<Meteor[]>([]);
  const nebulasRef = useRef<Nebula[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const mouseRef = useRef({ x: 0, y: 0 });
  const glowRef = useRef({ x: 0, y: 0 });
  const timeRef = useRef(0);
  const meteorTimerRef = useRef(0);
  const nextMeteorTimeRef = useRef(Math.random() * 7000 + 8000);
  const rafRef = useRef(0);
  const isMobile = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    isMobile.current = window.innerWidth < 768;
    const starCount = isMobile.current ? 200 : 400;

    function resize() {
      const dpr = Math.min(window.devicePixelRatio, 2);
      canvas!.width = window.innerWidth * dpr;
      canvas!.height = window.innerHeight * dpr;
      ctx!.scale(dpr, dpr);
      canvas!.style.width = window.innerWidth + 'px';
      canvas!.style.height = window.innerHeight + 'px';
    }

    function initStars() {
      starsRef.current = [];
      for (let i = 0; i < starCount; i++) {
        const layer = Math.random() > 0.7 ? 1 : 0;
        starsRef.current.push({
          x: Math.random() * window.innerWidth,
          y: Math.random() * window.innerHeight,
          size: layer === 1 ? Math.random() * 2.5 + 1 : Math.random() * 1.2 + 0.3,
          opacity: Math.random() * 0.7 + 0.3,
          targetOpacity: Math.random() * 0.7 + 0.3,
          twinkleSpeed: Math.random() * 0.02 + 0.005,
          twinklePhase: Math.random() * Math.PI * 2,
          layer,
        });
      }
    }

    function initMeteors() {
      meteorsRef.current = [];
      for (let i = 0; i < 3; i++) {
        meteorsRef.current.push({
          x: -100, y: -100, length: 0, speed: 0, angle: 0,
          opacity: 0, active: false, width: 0,
        });
      }
    }

    function initNebulas() {
      nebulasRef.current = [
        { x: window.innerWidth * 0.3, y: window.innerHeight * 0.4, radius: 300, color: '#2a3a6c', opacity: 0.04, phase: 0, speed: 0.0001 },
        { x: window.innerWidth * 0.7, y: window.innerHeight * 0.6, radius: 350, color: '#3a2a5c', opacity: 0.035, phase: Math.PI, speed: 0.00008 },
        { x: window.innerWidth * 0.5, y: window.innerHeight * 0.3, radius: 280, color: '#1a3a5c', opacity: 0.03, phase: Math.PI * 0.5, speed: 0.00012 },
      ];
    }

    function spawnMeteor() {
      const meteor = meteorsRef.current.find(m => !m.active);
      if (!meteor) return;
      const angle = (Math.random() * 30 + 15) * (Math.PI / 180);
      meteor.x = Math.random() * window.innerWidth + 200;
      meteor.y = -50 - Math.random() * 100;
      meteor.length = Math.random() * 150 + 100;
      meteor.speed = Math.random() * 4 + 6;
      meteor.angle = angle;
      meteor.opacity = 1;
      meteor.active = true;
      meteor.width = Math.random() * 2 + 1;
    }

    function spawnFirework(x: number, y: number) {
      const colors = ['#d4af77', '#e8c4a0', '#f5d4a0', '#ffd700', '#ffec8b'];
      for (let i = 0; i < 60; i++) {
        const angle = (Math.PI * 2 * i) / 60 + Math.random() * 0.3;
        const speed = Math.random() * 6 + 3;
        particlesRef.current.push({
          x, y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 2,
          life: 1,
          maxLife: Math.random() * 60 + 40,
          size: Math.random() * 3 + 1,
          color: colors[Math.floor(Math.random() * colors.length)],
        });
      }
    }

    function drawBackground() {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const gradient = ctx!.createRadialGradient(w * 0.5, h * 0.45, 0, w * 0.5, h * 0.45, Math.max(w, h) * 0.8);
      gradient.addColorStop(0, '#0d1b2a');
      gradient.addColorStop(0.4, '#0a1528');
      gradient.addColorStop(0.7, '#070e1a');
      gradient.addColorStop(1, '#050a18');
      ctx!.fillStyle = gradient;
      ctx!.fillRect(0, 0, w, h);
    }

    function drawNebulas(time: number) {
      nebulasRef.current.forEach(n => {
        const w = window.innerWidth;
        const h = window.innerHeight;
        const nx = n.x + Math.sin(time * n.speed + n.phase) * 30;
        const ny = n.y + Math.cos(time * n.speed * 0.7 + n.phase) * 20;
        const nr = n.radius + Math.sin(time * n.speed * 1.3) * 20;
        const grad = ctx!.createRadialGradient(nx, ny, 0, nx, ny, nr);
        grad.addColorStop(0, n.color);
        grad.addColorStop(1, 'transparent');
        ctx!.fillStyle = grad;
        ctx!.globalAlpha = n.opacity;
        ctx!.fillRect(0, 0, w, h);
        ctx!.globalAlpha = 1;
      });
    }

    function drawStars(time: number) {
      starsRef.current.forEach(star => {
        const twinkle = Math.sin(time * star.twinkleSpeed + star.twinklePhase);
        const opacity = star.opacity + twinkle * 0.3;
        const clampedOpacity = Math.max(0.1, Math.min(1, opacity));
        ctx!.globalAlpha = clampedOpacity;
        ctx!.fillStyle = star.layer === 1 ? '#f5f5f7' : '#a0a8b8';
        ctx!.beginPath();
        ctx!.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx!.fill();

        if (star.layer === 1 && star.size > 1.5) {
          ctx!.globalAlpha = clampedOpacity * 0.3;
          ctx!.beginPath();
          ctx!.arc(star.x, star.y, star.size * 2.5, 0, Math.PI * 2);
          ctx!.fill();
        }
      });
      ctx!.globalAlpha = 1;
    }

    function drawMeteors(dt: number) {
      meteorsRef.current.forEach(m => {
        if (!m.active) return;
        m.x -= Math.cos(m.angle) * m.speed;
        m.y += Math.sin(m.angle) * m.speed;
        m.opacity -= dt * 0.0008;

        if (m.opacity <= 0 || m.x < -300 || m.y > window.innerHeight + 300) {
          m.active = false;
          return;
        }

        const tailX = m.x + Math.cos(m.angle) * m.length;
        const tailY = m.y - Math.sin(m.angle) * m.length;
        const grad = ctx!.createLinearGradient(m.x, m.y, tailX, tailY);
        grad.addColorStop(0, `rgba(212,175,119,${m.opacity})`);
        grad.addColorStop(0.3, `rgba(212,175,119,${m.opacity * 0.6})`);
        grad.addColorStop(1, 'transparent');

        ctx!.strokeStyle = grad;
        ctx!.lineWidth = m.width;
        ctx!.lineCap = 'round';
        ctx!.beginPath();
        ctx!.moveTo(m.x, m.y);
        ctx!.lineTo(tailX, tailY);
        ctx!.stroke();

        ctx!.fillStyle = `rgba(255,255,255,${m.opacity})`;
        ctx!.beginPath();
        ctx!.arc(m.x, m.y, m.width * 1.5, 0, Math.PI * 2);
        ctx!.fill();
      });
    }

    function drawParticles() {
      particlesRef.current = particlesRef.current.filter(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.08;
        p.vx *= 0.99;
        p.life -= 1 / p.maxLife;
        if (p.life <= 0) return false;

        ctx!.globalAlpha = p.life;
        ctx!.fillStyle = p.color;
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
        ctx!.fill();
        return true;
      });
      ctx!.globalAlpha = 1;
    }

    function drawMouseGlow() {
      const gx = glowRef.current.x;
      const gy = glowRef.current.y;
      const grad = ctx!.createRadialGradient(gx, gy, 0, gx, gy, 150);
      grad.addColorStop(0, 'rgba(212,175,119,0.06)');
      grad.addColorStop(0.5, 'rgba(212,175,119,0.02)');
      grad.addColorStop(1, 'transparent');
      ctx!.fillStyle = grad;
      ctx!.fillRect(0, 0, window.innerWidth, window.innerHeight);
    }

    function drawCentralGlow(time: number) {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const cx = w * 0.5;
      const cy = h * 0.5;
      const breath = 0.4 + Math.sin(time * 0.0015) * 0.15;
      const grad = ctx!.createRadialGradient(cx, cy, 0, cx, cy, 250);
      grad.addColorStop(0, `rgba(212,175,119,${breath * 0.15})`);
      grad.addColorStop(0.5, `rgba(212,175,119,${breath * 0.05})`);
      grad.addColorStop(1, 'transparent');
      ctx!.fillStyle = grad;
      ctx!.fillRect(0, 0, w, h);
    }

    let lastTime = 0;
    function animate(timestamp: number) {
      const dt = timestamp - lastTime;
      lastTime = timestamp;
      timeRef.current = timestamp;

      ctx!.clearRect(0, 0, window.innerWidth, window.innerHeight);

      drawBackground();
      drawNebulas(timestamp);
      drawStars(timestamp);
      drawMeteors(dt);
      drawParticles();
      drawCentralGlow(timestamp);
      drawMouseGlow();

      // Lerp mouse glow
      glowRef.current.x += (mouseRef.current.x - glowRef.current.x) * 0.05;
      glowRef.current.y += (mouseRef.current.y - glowRef.current.y) * 0.05;

      // Meteor spawn
      meteorTimerRef.current += dt;
      if (meteorTimerRef.current > nextMeteorTimeRef.current) {
        spawnMeteor();
        meteorTimerRef.current = 0;
        nextMeteorTimeRef.current = Math.random() * 7000 + 8000;
      }

      rafRef.current = requestAnimationFrame(animate);
    }

    const onMouseMove = (e: MouseEvent) => {
      mouseRef.current.x = e.clientX;
      mouseRef.current.y = e.clientY;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        mouseRef.current.x = e.touches[0].clientX;
        mouseRef.current.y = e.touches[0].clientY;
      }
    };

    resize();
    initStars();
    initMeteors();
    initNebulas();
    rafRef.current = requestAnimationFrame(animate);

    window.addEventListener('resize', () => {
      resize();
      initStars();
      initNebulas();
    });
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('touchmove', onTouchMove, { passive: true });

    // Expose firework function
    (window as any).triggerFirework = (x: number, y: number) => {
      spawnFirework(x, y);
    };
    (window as any).triggerMeteor = () => {
      spawnMeteor();
    };
    (window as any).triggerBigFireworks = () => {
      for (let i = 0; i < 8; i++) {
        setTimeout(() => {
          spawnFirework(
            Math.random() * window.innerWidth,
            window.innerHeight * 0.7 + Math.random() * window.innerHeight * 0.3
          );
        }, i * 200);
      }
    };

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('touchmove', onTouchMove);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: 0,
        pointerEvents: 'none',
      }}
    />
  );
}
