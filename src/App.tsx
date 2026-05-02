import StarCanvas from './components/StarCanvas';
import HoneycombGrid from './components/HoneycombGrid';

export default function App() {
  return (
    <div className="relative w-full h-full overflow-hidden" style={{ background: '#050a18' }}>
      {/* Star background canvas */}
      <StarCanvas />

      {/* Honeycomb grid */}
      <HoneycombGrid />

      {/* Bottom signature */}
      <div
        className="fixed bottom-4 left-0 right-0 text-center pointer-events-none"
        style={{ zIndex: 10 }}
      >
        <p
          style={{
            fontSize: '12px',
            color: '#a0a8b8',
            opacity: 0.6,
            letterSpacing: '0.08em',
            fontFamily: "'Noto Serif SC', serif",
          }}
        >
          —— 来自 2025 届全体学长学姐 · 网页制作人：创三孙承泽
        </p>
      </div>

      {/* Top title hint */}
      <div
        className="fixed top-6 left-0 right-0 text-center pointer-events-none"
        style={{ zIndex: 10 }}
      >
        <p
          style={{
            fontSize: '13px',
            color: '#a0a8b8',
            opacity: 0.5,
            letterSpacing: '0.15em',
            fontFamily: "'Noto Serif SC', serif",
          }}
        >
          拖拽探索 · 滚轮缩放 · 点击名字查看祝福
        </p>
      </div>
    </div>
  );
}
