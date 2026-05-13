import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { Scene } from './BuildingMass';
import { ARCH_STYLES } from '../data/architectStyles';

export const FACADE_PROPOSALS = [
  {
    id: 'default',
    label: '기본 매스',
    sub: 'Generic',
    color: '#64748B',
    architectStyleId: null,
    facadePreset: null,
  },
  {
    id: 'hafencity',
    label: '하펜시티',
    sub: 'Red Brick',
    color: '#8B3318',
    architectStyleId: null,
    facadePreset: 'hafencity',
  },
  {
    id: 'marunouchi',
    label: '마루노우치',
    sub: 'Curtain Wall',
    color: '#5A8099',
    architectStyleId: 'marunouchi',
    facadePreset: null,
  },
  {
    id: 'ando',
    label: '안도 다다오',
    sub: 'Concrete',
    color: '#4A5058',
    architectStyleId: 'ando',
    facadePreset: null,
  },
  {
    id: 'zaha',
    label: '자하 하디드',
    sub: 'Parametric',
    color: '#AABBCC',
    architectStyleId: 'zaha',
    facadePreset: null,
  },
];

function MiniCanvas({ params, activeRuleSet, architectStyle, facadePreset }) {
  return (
    <Canvas
      frameloop="always"
      camera={{ position: [72, 52, 95], fov: 46, near: 0.5, far: 5000 }}
      gl={{ preserveDrawingBuffer: false, antialias: true }}
      shadows
    >
      <Scene
        params={params}
        activeRuleSet={activeRuleSet}
        showPedestrians={false}
        architectStyle={architectStyle}
        facadePreset={facadePreset}
        mini={true}
      />
      <OrbitControls
        target={[0, 20, 18]}
        enablePan={false}
        enableZoom={false}
        enableRotate={false}
      />
    </Canvas>
  );
}

export default function FacadeProposalPanel({ params, activeRuleSet, selectedId, onSelect }) {
  return (
    <div className="shrink-0 border-t border-slate-800 bg-slate-950">
      <div className="px-3 pt-2.5 pb-1 flex items-center gap-2">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">파사드 제안</span>
        <span className="text-xs text-slate-600">— 동일 매스, 다양한 저층부 스타일</span>
      </div>
      <div className="flex gap-3 px-3 pb-3 overflow-x-auto">
        {FACADE_PROPOSALS.map(p => {
          const style = p.architectStyleId ? ARCH_STYLES[p.architectStyleId] : null;
          const isSelected = selectedId === p.id;
          return (
            <button
              key={p.id}
              onClick={() => onSelect(p)}
              className="shrink-0 rounded-lg overflow-hidden transition-all focus:outline-none"
              style={{
                width: 190,
                border: `2px solid ${isSelected ? p.color : '#334155'}`,
                boxShadow: isSelected ? `0 0 16px ${p.color}55` : 'none',
              }}
            >
              {/* 미니 3D 뷰 */}
              <div style={{ width: 186, height: 130, pointerEvents: 'none', background: '#EEF2F7' }}>
                <MiniCanvas
                  params={params}
                  activeRuleSet={activeRuleSet}
                  architectStyle={style}
                  facadePreset={p.facadePreset}
                />
              </div>
              {/* 라벨 */}
              <div
                className="py-1.5 px-2 flex items-center justify-between"
                style={{ background: isSelected ? `${p.color}22` : '#1E293B' }}
              >
                <div className="text-left">
                  <p className="text-xs font-semibold text-slate-200 leading-tight">{p.label}</p>
                  <p className="text-xs text-slate-500">{p.sub}</p>
                </div>
                {isSelected && (
                  <span className="text-xs font-bold px-1.5 py-0.5 rounded" style={{ background: p.color, color: '#fff' }}>
                    적용중
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
