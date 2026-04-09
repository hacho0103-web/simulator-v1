import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine, ReferenceArea,
} from 'recharts';
import { calculateScores } from '../utils/scoring';
import { RULE_SETS } from '../data/rulesets';

const CustomDot = (props) => {
  const { cx, cy, fill, name } = props;
  if (name === '현재 설정값') {
    return (
      <polygon
        points={`${cx},${cy - 10} ${cx + 9},${cy + 6} ${cx - 9},${cy + 6}`}
        fill="#F59E0B"
        stroke="#FDE68A"
        strokeWidth={1.5}
      />
    );
  }
  return <circle cx={cx} cy={cy} r={8} fill={fill} stroke="white" strokeWidth={1.5} />;
};

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  return (
    <div className="bg-slate-800 border border-slate-600 rounded-lg p-3 text-xs">
      <p className="font-semibold text-white mb-1">{d.name}</p>
      <p className="text-cyan-400">P-index (공공성): {d.y}</p>
      <p className="text-orange-400">D-index (사업성): {d.x}</p>
    </div>
  );
};

/**
 * P-index vs D-index 산점도 (논문 6단계 균형 분석)
 */
export default function ScatterPlot({ params }) {
  const customScores = calculateScores(params);

  const presetPoints = Object.values(RULE_SETS).map((rs) => {
    const s = calculateScores(rs.params);
    return { x: s.dIndex, y: s.pIndex, name: rs.name, fill: rs.color };
  });

  const customPoint = [{ x: customScores.dIndex, y: customScores.pIndex, name: '현재 설정값', fill: '#F59E0B' }];

  return (
    <div className="bg-slate-900 rounded-xl p-4 h-full">
      <h3 className="text-sm font-semibold text-slate-300 mb-1">
        P-index vs D-index 균형 분석
      </h3>
      <p className="text-xs text-slate-500 mb-3">
        공공성(↑)과 사업성(→) 균형 — 오른쪽 위가 이상적
      </p>

      <ResponsiveContainer width="100%" height={280}>
        <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 10 }}>
          <CartesianGrid stroke="#1e293b" />

          {/* 균형 영역 (점선 박스) */}
          <ReferenceArea
            x1={50} x2={80} y1={50} y2={80}
            fill="#1d4ed8"
            fillOpacity={0.08}
            stroke="#3B82F6"
            strokeDasharray="4 2"
            label={{ value: '균형 영역', position: 'insideTopLeft', fill: '#60A5FA', fontSize: 10 }}
          />

          <XAxis
            type="number"
            dataKey="x"
            name="D-index"
            domain={[0, 100]}
            label={{ value: 'D-index (사업성)', position: 'insideBottom', offset: -10, fill: '#94A3B8', fontSize: 11 }}
            tick={{ fill: '#64748b', fontSize: 10 }}
          />
          <YAxis
            type="number"
            dataKey="y"
            name="P-index"
            domain={[0, 100]}
            label={{ value: 'P-index (공공성)', angle: -90, position: 'insideLeft', fill: '#94A3B8', fontSize: 11 }}
            tick={{ fill: '#64748b', fontSize: 10 }}
          />

          <Tooltip content={<CustomTooltip />} />

          {/* 도시별 프리셋 점 */}
          {presetPoints.map((point) => (
            <Scatter
              key={point.name}
              name={point.name}
              data={[point]}
              fill={point.fill}
              shape={<CustomDot name={point.name} />}
            />
          ))}

          {/* 현재 슬라이더 값 (별 모양) */}
          <Scatter
            name="현재 설정값"
            data={customPoint}
            fill="#F59E0B"
            shape={<CustomDot name="현재 설정값" />}
          />

          <Legend
            wrapperStyle={{ fontSize: '11px', color: '#94A3B8', paddingTop: '8px' }}
          />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
