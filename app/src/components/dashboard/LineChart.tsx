import { useState } from 'react';
import { View } from 'react-native';
import Svg, { Circle, G, Line, Path, Text as SvgText } from 'react-native-svg';

import { fonts } from '@/lib/theme';

import { d, DText } from './dash';

export type Series = { id: string; label: string; color: string; values: number[]; dashed?: boolean };

/**
 * Simple multi-line chart: one y-axis, recessive grid, 2px lines, legend + direct end labels,
 * crosshair tooltip on hover/touch.
 */
export function LineChart({
  series,
  height = 260,
  yMax,
  yLabel,
  format = (v) => `${Math.round(v)}`,
  xLabel = 'Day',
}: {
  series: Series[];
  height?: number;
  yMax?: number;
  yLabel: string;
  format?: (v: number) => string;
  xLabel?: string;
}) {
  const [width, setWidth] = useState(600);
  const [hover, setHover] = useState<number | null>(null);
  const n = Math.max(...series.map((s) => s.values.length));
  const top = Math.max(1, yMax ?? Math.max(...series.flatMap((s) => s.values)) * 1.1);
  const pad = { l: 44, r: 128, t: 12, b: 30 };
  const w = Math.max(200, width - pad.l - pad.r);
  const h = height - pad.t - pad.b;
  const x = (i: number) => pad.l + (n <= 1 ? 0 : (i / (n - 1)) * w);
  const y = (v: number) => pad.t + h - (Math.max(0, v) / top) * h;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * top);
  const xticks = Array.from({ length: 7 }, (_, k) => Math.round((k / 6) * (n - 1)));

  // End labels: keep them from overlapping by spreading them at least 14px apart.
  const ends = series
    .map((s) => ({ s, y: y(s.values[s.values.length - 1] ?? 0) }))
    .sort((a, b) => a.y - b.y);
  for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 14) ends[i].y = ends[i - 1].y + 14;

  const onMove = (px: number) => {
    const i = Math.round(((px - pad.l) / w) * (n - 1));
    setHover(i >= 0 && i < n ? i : null);
  };

  return (
    <View
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      onPointerMove={(e) => onMove(e.nativeEvent.offsetX)}
      onPointerLeave={() => setHover(null)}
      onTouchMove={(e) => onMove(e.nativeEvent.locationX)}
      style={{ width: '100%' }}
    >
      <Svg width={width} height={height}>
        {ticks.map((t) => (
          <G key={t}>
            <Line x1={pad.l} x2={pad.l + w} y1={y(t)} y2={y(t)} stroke={d.grid} strokeWidth={1} />
            <SvgText x={pad.l - 8} y={y(t) + 4} fontSize={11} fill={d.muted} textAnchor="end" fontFamily={fonts.bodySemi}>
              {format(t)}
            </SvgText>
          </G>
        ))}
        {xticks.map((i) => (
          <SvgText key={i} x={x(i)} y={height - 8} fontSize={11} fill={d.muted} textAnchor="middle" fontFamily={fonts.bodySemi}>
            {i}
          </SvgText>
        ))}
        {series.map((s) => (
          <Path
            key={s.id}
            d={s.values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ')}
            stroke={s.color}
            strokeWidth={2}
            fill="none"
            strokeDasharray={s.dashed ? '6 4' : undefined}
            strokeLinejoin="round"
          />
        ))}
        {ends.map(({ s, y: ly }) => (
          <G key={s.id}>
            <Circle cx={x(s.values.length - 1)} cy={y(s.values[s.values.length - 1] ?? 0)} r={4} fill={s.color} stroke={d.surface} strokeWidth={2} />
            <SvgText x={pad.l + w + 8} y={ly + 4} fontSize={11} fill={d.ink} fontFamily={fonts.bodyBold}>
              {`${format(s.values[s.values.length - 1] ?? 0)} ${s.label.length > 16 ? s.label.slice(0, 15) + '…' : s.label}`}
            </SvgText>
          </G>
        ))}
        {hover != null && (
          <G>
            <Line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={pad.t + h} stroke={d.ink2} strokeWidth={1} strokeDasharray="3 3" />
            {series.map((s) => (
              <Circle key={s.id} cx={x(hover)} cy={y(s.values[hover] ?? 0)} r={4.5} fill={s.color} stroke={d.surface} strokeWidth={2} />
            ))}
          </G>
        )}
      </Svg>
      {hover != null && (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 8,
            left: Math.min(x(hover) + 10, width - 210),
            width: 200,
            backgroundColor: d.surface,
            borderColor: d.border,
            borderWidth: 1,
            borderRadius: 8,
            padding: 8,
            gap: 2,
          }}
        >
          <DText v="label">
            {xLabel} {hover}
          </DText>
          {series.map((s) => (
            <View key={s.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={{ width: 10, height: 3, borderRadius: 2, backgroundColor: s.color }} />
              <DText v="small" style={{ flex: 1 }} numberOfLines={1}>
                {s.label}
              </DText>
              <DText v="h3">{format(s.values[hover] ?? 0)}</DText>
            </View>
          ))}
        </View>
      )}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 6 }}>
        {series.map((s) => (
          <View key={s.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Svg width={22} height={6}>
              <Line x1={0} x2={22} y1={3} y2={3} stroke={s.color} strokeWidth={2.5} strokeDasharray={s.dashed ? '5 3' : undefined} />
            </Svg>
            <DText v="small">{s.label}</DText>
          </View>
        ))}
        <DText v="small" style={{ color: d.muted }}>
          y: {yLabel} · x: {xLabel.toLowerCase()}s
        </DText>
      </View>
    </View>
  );
}
