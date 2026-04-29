import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine, ReferenceArea,
} from 'recharts';
import { calculateScores } from '../utils/scoring';
import { RULE_SETS } from '../data/rulesets';

const CustomDot = (props) => {
  const { cx, cy, name } = props;
  if (name === '현재 설정값') {
    return (
      <polygon
        points={`${cx},${cy - 9} ${cx + 8},${cy + 5} ${cx - 8},${cy + 5}`}
        fill="#1a1a1a"
        stroke="#ffffff"
        strokeWidth={1.5}
      />
    );
  }
  return <circle cx={cx} cy={cy} r={7} fill={props.fill} stroke="#ffffff" strokeWidth={1.5} />;
};

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  return (
    <div style={{
      background: '#ffffff',
      border: '1px solid #d8d8d4',
      borderRadius: '3px',
      padding: '8px 12px',
      fontSize: '11px',
    }}>
      <p style={{ fontWeight: 600, color: '#1a1a1a', marginBottom: 4 }}>{d.name}</p>
      <p style={{ color: '#2563eb' }}>P-index (공공성): {d.y}</p>
      <p style={{ color: '#ea580c' }}>D-index (사업성): {d.x}</p>
    </div>
  );
};

export default function ScatterPlot({ params }) {
  const customScores = calculateScores(params);

  const presetPoints = Object.values(RULE_SETS).map((rs) => {
    const s = calculateScores(rs.params);
    return { x: s.dIndex, y: s.pIndex, name: rs.name, fill: rs.color };
  });

  const customPoint = [{ x: customScores.dIndex, y: customScores.pIndex, name: '현재 설정값', fill: '#1a1a1a' }];

  return (
    <div className="bg-white border border-[#d8d8d4] rounded h-full p-4">
      <h3 className="text-[10px] font-semibold text-[#888880] uppercase tracking-widest mb-0.5">
        P-index vs D-index
      </h3>
      <p className="text-[10px] text-[#888880] mb-2 italic">
        공공성(↑)과 사업성(→) 균형 — 오른쪽 위가 이상적
      </p>

      <ResponsiveContainer width="100%" height={240}>
        <ScatterChart margin={{ top: 8, right: 16, bottom: 20, left: 8 }}>
          <CartesianGrid stroke="#e8e8e5" />

          <ReferenceArea
            x1={50} x2={80} y1={50} y2={80}
            fill="#2563eb"
            fillOpacity={0.05}
            stroke="#2563eb"
            strokeDasharray="4 2"
            strokeOpacity={0.4}
            label={{ value: '균형 영역', position: 'insideTopLeft', fill: '#2563eb', fontSize: 9 }}
          />

          <XAxis
            type="number"
            dataKey="x"
            name="D-index"
            domain={[0, 100]}
            label={{ value: 'D-index (사업성)', position: 'insideBottom', offset: -10, fill: '#888880', fontSize: 10 }}
            tick={{ fill: '#888880', fontSize: 9 }}
          />
          <YAxis
            type="number"
            dataKey="y"
            name="P-index"
            domain={[0, 100]}
            label={{ value: 'P-index (공공성)', angle: -90, position: 'insideLeft', fill: '#888880', fontSize: 10 }}
            tick={{ fill: '#888880', fontSize: 9 }}
          />

          <Tooltip content={<CustomTooltip />} />

          {presetPoints.map((point) => (
            <Scatter
              key={point.name}
              name={point.name}
              data={[point]}
              fill={point.fill}
              shape={<CustomDot name={point.name} />}
            />
          ))}

          <Scatter
            name="현재 설정값"
            data={customPoint}
            fill="#1a1a1a"
            shape={<CustomDot name="현재 설정값" />}
          />

          <Legend
            wrapperStyle={{ fontSize: '10px', color: '#888880', paddingTop: '6px' }}
          />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
