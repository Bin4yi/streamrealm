import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { Linking, Platform, Pressable, ScrollView, StyleSheet, TextInput, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { d, DButton, DText, Panel } from '@/components/dashboard/dash';
import { LineChart } from '@/components/dashboard/LineChart';
import GameMap from '@/components/map/GameMap';
import { FRESHNESS_STOPS, HEALTH_STOPS, type MapLayerMode } from '@/components/map/types';
import { api, API_URL, photoUrl, useCities, useTiles, type TileProps } from '@/lib/api';
import { ago } from '@/lib/format';
import { ANSWER_LABEL, QUESTION_IDS, QUESTION_LABEL, TREASURE_INFO, type Answers, type TreasureType } from '@/lib/gameRules';
import { useGame } from '@/lib/store';
import { fonts, teams, type TeamId } from '@/lib/theme';

type Kpis = {
  tiles_total: number;
  coverage_pct: number;
  median_data_age_days: number | null;
  never_checked: number;
  confirmed_pct: number;
  observations_total: number;
  open_disputes: number;
  open_treasures: number;
  fixed_treasures: number;
  unsafe_tiles: number;
  active_players_week: number;
  bot_share_pct: number;
  suggestion_disagreements: { shown: number; kept_own_answer: number };
};
type ObsView = {
  id: string;
  nickname: string;
  team: TeamId;
  is_bot: boolean;
  created_at: string;
  answers: Answers;
  health_score: number;
  photo_up: string | null;
  photo_down: string | null;
};
type Dispute = { tile: TileProps; defender: ObsView | null; attacker: ObsView; agreement: number | null; differences: string[] };
type TreasureRow = {
  id: string;
  type: TreasureType;
  status: 'open' | 'reviewed' | 'needs_action' | 'fixed';
  note: string;
  photo: string | null;
  created_at: string;
  tile_id: string;
  stream_name: string;
  unsafe: boolean;
  reporter: string;
  reporter_is_bot: boolean;
  team: TeamId | null;
};
type WorldSeries = { coverage_pct: number[]; median_age_days: number[]; confirmed_pct: number[] };
type Experiment = {
  title: string;
  days: number;
  assumptions: string[];
  worlds: Record<string, WorldSeries & { label: string }>;
  summary: Record<string, string | number>;
};

const LAYERS: { id: MapLayerMode; label: string }[] = [
  { id: 'freshness', label: 'Freshness' },
  { id: 'health', label: 'Health score' },
  { id: 'disputes', label: 'Disputes' },
  { id: 'treasures', label: 'Treasures' },
];

function daysAgo(iso: string, warp: number) {
  return (Date.now() + warp * 86_400_000 - new Date(iso).getTime()) / 86_400_000;
}

function openUrl(url: string) {
  if (Platform.OS === 'web') window.open(url, '_blank');
  else Linking.openURL(url);
}

function Kpi({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: string }) {
  return (
    <View style={styles.kpi}>
      <DText v="label">{label}</DText>
      <DText v="kpi" style={tone ? { color: tone } : undefined}>
        {value}
      </DText>
      {hint ? <DText v="small">{hint}</DText> : null}
    </View>
  );
}

function Ramp({ stops, left, right, mid }: { stops: [number, string][]; left: string; right: string; mid?: string }) {
  const max = stops[stops.length - 1][0];
  return (
    <View style={{ gap: 4, minWidth: 220 }}>
      <View style={{ flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden' }}>
        {stops.slice(1).map(([v, c], i) => (
          <View key={v} style={{ flex: (v - stops[i][0]) / max, backgroundColor: c }} />
        ))}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <DText v="small">{left}</DText>
        {mid ? <DText v="small">{mid}</DText> : null}
        <DText v="small">{right}</DText>
      </View>
    </View>
  );
}

function Legend({ mode }: { mode: MapLayerMode }) {
  if (mode === 'freshness') return <Ramp stops={FRESHNESS_STOPS} left="checked today" mid="14 days" right="30+ days" />;
  if (mode === 'health') return <Ramp stops={HEALTH_STOPS} left="0 poor" mid="50" right="100 good" />;
  if (mode === 'disputes') return <DText v="small">Only disputed tiles are shown, with ⚔️ markers.</DText>;
  return <DText v="small">Tiles with open treasures (💎). Gray dashed = never checked.</DText>;
}

function Answer({ q, a, other }: { q: string; a?: Answers; other?: Answers }) {
  const v = a?.[q as keyof Answers];
  const differs = other && v !== other[q as keyof Answers];
  return (
    <View style={[styles.ansRow, differs && { backgroundColor: '#FBEAF1' }]}>
      <DText v="small" style={{ width: 110 }}>
        {QUESTION_LABEL[q as keyof typeof QUESTION_LABEL]}
      </DText>
      <DText v="h3" style={differs ? { color: d.dispute } : undefined}>
        {v ? ANSWER_LABEL[v] : '–'}
      </DText>
    </View>
  );
}

function ObsColumn({ title, o, other, warp }: { title: string; o: ObsView | null; other?: ObsView | null; warp: number }) {
  if (!o) return null;
  return (
    <View style={{ flex: 1, gap: 6, minWidth: 220 }}>
      <DText v="label">{title}</DText>
      <DText v="h3">
        {teams[o.team].emoji} {o.nickname} {o.is_bot ? <DText v="small">(demo bot)</DText> : null}
      </DText>
      <DText v="small">
        {ago(daysAgo(o.created_at, warp))} · health {o.health_score}
      </DText>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {[o.photo_up, o.photo_down].map((p, i) =>
          p ? <Image key={i} source={{ uri: photoUrl(p)! }} style={styles.photo} contentFit="cover" /> : <View key={i} style={styles.photo} />,
        )}
      </View>
      {QUESTION_IDS.map((q) => (
        <Answer key={q} q={q} a={o.answers} other={other?.answers} />
      ))}
    </View>
  );
}

export default function Dashboard() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const wide = width >= 1000;
  const qc = useQueryClient();
  const warp = useGame((s) => s.timeWarpDays);
  const city = useGame((s) => s.city);
  const cities = useCities();
  const tiles = useTiles();
  const [layer, setLayer] = useState<MapLayerMode>('freshness');
  const [selected, setSelected] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [metric, setMetric] = useState<keyof WorldSeries>('coverage_pct');

  const kpis = useQuery({ queryKey: ['kpis', warp], queryFn: () => api.get<Kpis>(`/dashboard/kpis?time_warp_days=${warp}`), refetchInterval: 15_000 });
  const disputes = useQuery({ queryKey: ['disputes', warp], queryFn: () => api.get<Dispute[]>(`/dashboard/disputes?time_warp_days=${warp}`), refetchInterval: 15_000 });
  const treasures = useQuery({ queryKey: ['treasures'], queryFn: () => api.get<TreasureRow[]>('/dashboard/treasures'), refetchInterval: 15_000 });
  const experiment = useQuery({ queryKey: ['experiment'], queryFn: () => api.get<Experiment>('/experiment/coverage'), retry: false });

  const cityInfo = cities.data?.find((c) => c.key === city);
  const sel = tiles.data?.features.find((f) => f.id === selected)?.properties;
  const refresh = () => qc.invalidateQueries();
  type KingdomChange = { kingdom?: { team: TeamId | null; before: number | null; after: number | null } };
  const act = async (fn: () => Promise<unknown>, msg: string | ((r: KingdomChange) => string)) => {
    try {
      const r = (await fn()) as KingdomChange;
      setToast(typeof msg === 'string' ? msg : msg(r));
      refresh();
      setTimeout(() => setToast(null), 5000);
    } catch (e) {
      setToast(e instanceof Error ? e.message : 'Action failed');
    }
  };

  const k = kpis.data;
  const kingdomMsg = (head: string) => (r: KingdomChange) =>
    r.kingdom?.team
      ? `${head} Team ${teams[r.kingdom.team].name} kingdom health: ${r.kingdom.before ?? '–'} → ${r.kingdom.after ?? '–'} 🌱`
      : `${head} (Nobody holds this tile right now, so no kingdom changes.)`;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: d.page }} contentContainerStyle={{ paddingTop: insets.top, paddingBottom: 48 }}>
      <View style={styles.top}>
        <View style={{ flex: 1, minWidth: 260 }}>
          <DText v="h1">StreamRealm · Science dashboard</DText>
          <DText v="small">
            {cityInfo?.name ?? city} · {k ? `${k.observations_total} checks` : '…'} · demo data: {k?.bot_share_pct ?? '–'}% of checks are by bots or use demo photos
            {warp ? ` · time warp +${warp} days` : ''}
          </DText>
        </View>
        <View style={styles.row}>
          <DButton label="Export CSV" onPress={() => openUrl(`${API_URL}/export/csv`)} />
          <DButton label="GeoJSON" onPress={() => openUrl(`${API_URL}/export/geojson?time_warp_days=${warp}`)} />
          <DButton label="FHIR R4 bundle" kind="primary" onPress={() => openUrl(`${API_URL}/export/fhir`)} testID="export-fhir" />
          <DButton label="← Back to game" onPress={() => (router.canGoBack() ? router.back() : router.replace('/map'))} />
        </View>
      </View>

      <View style={styles.body}>
        <DText v="small" style={styles.note}>
          Health scores come from simple visual checks by citizens. They are a game indicator, not a lab measurement, and never mean
          “safe to swim”. Unconfirmed checks are preliminary.
        </DText>

        {toast && (
          <View style={styles.toast}>
            <DText v="h3">{toast}</DText>
          </View>
        )}

        <View style={[styles.kpis, !wide && { flexWrap: 'wrap' }]}>
            <View style={[styles.kpi, styles.hero]}>
              <DText v="label">Coverage (checked in the last 14 days)</DText>
              <DText v="hero">{k ? `${k.coverage_pct}%` : '…'}</DText>
              <DText v="small">{k ? `${k.never_checked} of ${k.tiles_total} tiles never checked` : ''}</DText>
            </View>
            <Kpi label="Tiles" value={k ? `${k.tiles_total}` : '…'} hint="~100 m stream sections" />
            <Kpi label="Median data age" value={k?.median_data_age_days != null ? `${k.median_data_age_days} d` : '…'} hint="checked tiles only" />
            <Kpi label="Independently confirmed" value={k ? `${k.confirmed_pct}%` : '…'} hint="of all checks" />
            <Kpi label="Open disputes" value={k ? `${k.open_disputes}` : '…'} tone={k?.open_disputes ? d.dispute : undefined} />
            <Kpi label="Open treasures" value={k ? `${k.open_treasures}` : '…'} hint={k ? `${k.fixed_treasures} fixed · ${k.unsafe_tiles} unsafe tiles` : ''} />
          </View>

        <View style={[styles.grid, !wide && { flexDirection: 'column' }]}>
          <Panel
            title="Map"
            style={{ flex: 1.4 }}
            right={
              <View style={styles.row}>
                {LAYERS.map((l) => (
                  <DButton key={l.id} small label={l.label} kind={layer === l.id ? 'active' : 'default'} onPress={() => setLayer(l.id)} />
                ))}
              </View>
            }
          >
            <View style={styles.map}>
              <GameMap
                tiles={tiles.data}
                center={cityInfo?.center ?? [-8.405, 40.2225]}
                zoom={(cityInfo?.zoom ?? 14) - 1.1}
                mode={layer}
                selectedTileId={selected}
                onTilePress={setSelected}
                onMapPress={() => setSelected(null)}
              />
            </View>
            <View style={[styles.row, { justifyContent: 'space-between' }]}>
              <Legend mode={layer} />
              {sel && (
                <View style={styles.sel}>
                  <DText v="h3">
                    {sel.stream_name} {sel.unsafe ? '⚠️' : ''}
                  </DText>
                  <DText v="small">
                    {sel.state.replace('owned_', '')} · {sel.owner_team ? teams[sel.owner_team].name : 'no owner'} · last check {ago(sel.age_days)} · health{' '}
                    {sel.health ?? '–'}
                  </DText>
                  <View style={styles.row}>
                    <DButton
                      small
                      label="Log cleanup event"
                      onPress={() => act(() => api.post(`/dashboard/tiles/${sel.id}/cleanup?time_warp_days=${warp}`, { note: 'Cleanup logged by scientist' }), kingdomMsg('Cleanup logged: tile health +10.'))}
                    />
                    <DButton
                      small
                      label={sel.unsafe ? 'Mark safe' : 'Mark unsafe'}
                      kind={sel.unsafe ? 'default' : 'danger'}
                      onPress={() => act(() => api.post(`/dashboard/tiles/${sel.id}/unsafe?value=${!sel.unsafe}`), sel.unsafe ? 'Tile marked safe.' : 'Tile marked unsafe. Players cannot check it.')}
                    />
                  </View>
                </View>
              )}
            </View>
          </Panel>

          <Panel title={`Dispute queue (${disputes.data?.length ?? 0})`} style={{ flex: 1, maxHeight: wide ? 640 : undefined }}>
            <DText v="small">Two checks disagree. Compare the photos and answers, then pick the side that is right. A third player check can also settle it.</DText>
            <ScrollView style={{ maxHeight: wide ? 540 : undefined }} contentContainerStyle={{ gap: 12 }}>
              {disputes.data?.length === 0 && <DText v="small">No open disputes. 🎉</DText>}
              {disputes.data?.map((dp) => (
                <View key={dp.tile.id} style={styles.card}>
                  <View style={styles.row}>
                    <DText v="h3" style={{ flex: 1 }}>
                      ⚔️ {dp.tile.stream_name}
                    </DText>
                    <DText v="small">agreement {dp.agreement != null ? Math.round(dp.agreement * 100) : '–'}% · {dp.differences.length} answers differ</DText>
                  </View>
                  <View style={[styles.row, { alignItems: 'flex-start' }]}>
                    <ObsColumn title="Defender (earlier check)" o={dp.defender} other={dp.attacker} warp={warp} />
                    <ObsColumn title="Attacker (new check)" o={dp.attacker} other={dp.defender} warp={warp} />
                  </View>
                  <View style={styles.row}>
                    <DButton
                      label="Defender is right"
                      testID={`resolve-def-${dp.tile.id}`}
                      onPress={() => act(() => api.post(`/dashboard/disputes/${dp.tile.id}/resolve?time_warp_days=${warp}`, { winner: 'defender' }), `Dispute on ${dp.tile.stream_name} resolved: defender confirmed.`)}
                    />
                    <DButton
                      label="Attacker is right"
                      onPress={() => act(() => api.post(`/dashboard/disputes/${dp.tile.id}/resolve?time_warp_days=${warp}`, { winner: 'attacker' }), `Dispute on ${dp.tile.stream_name} resolved: attacker confirmed.`)}
                    />
                    <DButton small label="Show on map" onPress={() => setSelected(dp.tile.id)} />
                  </View>
                </View>
              ))}
            </ScrollView>
          </Panel>
        </View>

        <Panel title={`Treasure queue (${treasures.data?.filter((t) => t.status !== 'fixed').length ?? 0} open)`}>
          <DText v="small">Pipes, trash, wildlife, plants and algae that players found. Mark them as you work. “Fixed” raises the tile health (+15) and the kingdom health of the team that holds it.</DText>
          <View style={styles.treasures}>
            {treasures.data?.map((t) => (
              <View key={t.id} style={[styles.card, styles.treasure, t.status === 'fixed' && { opacity: 0.6 }]}>
                <View style={styles.row}>
                  {t.photo ? <Image source={{ uri: photoUrl(t.photo)! }} style={styles.tphoto} contentFit="cover" /> : <View style={styles.tphoto} />}
                  <View style={{ flex: 1, gap: 2 }}>
                    <DText v="h3">
                      {TREASURE_INFO[t.type].emoji} {TREASURE_INFO[t.type].label}
                    </DText>
                    <DText v="small" numberOfLines={1}>
                      {t.stream_name} {t.unsafe ? '· ⚠️ unsafe' : ''}
                    </DText>
                    <DText v="small">
                      by {t.reporter}
                      {t.reporter_is_bot ? ' (demo bot)' : ''} · {ago(daysAgo(t.created_at, 0))}
                    </DText>
                    <DText v="label" style={{ color: t.status === 'fixed' ? d.good : t.status === 'needs_action' ? d.serious : d.ink2 }}>
                      {t.status === 'fixed' ? '✓ Fixed' : t.status === 'needs_action' ? '! Needs action' : t.status === 'reviewed' ? '● Reviewed' : '○ Open'}
                    </DText>
                  </View>
                </View>
                <TextInput
                  placeholder="Note (optional)"
                  placeholderTextColor={d.muted}
                  value={notes[t.id] ?? t.note}
                  onChangeText={(v) => setNotes((n) => ({ ...n, [t.id]: v }))}
                  style={styles.input}
                />
                <View style={[styles.row, { flexWrap: 'wrap' }]}>
                  <DButton small label="Reviewed" kind={t.status === 'reviewed' ? 'active' : 'default'} onPress={() => act(() => api.patch(`/dashboard/treasures/${t.id}`, { status: 'reviewed', note: notes[t.id] }), 'Marked as reviewed.')} />
                  <DButton small label="Needs action" kind={t.status === 'needs_action' ? 'active' : 'default'} onPress={() => act(() => api.patch(`/dashboard/treasures/${t.id}`, { status: 'needs_action', note: notes[t.id] }), 'Marked: needs action.')} />
                  <DButton
                    small
                    label="Fixed"
                    kind="good"
                    disabled={t.status === 'fixed'}
                    testID={`fix-${t.id}`}
                    onPress={() =>
                      act(
                        () => api.patch(`/dashboard/treasures/${t.id}?time_warp_days=${warp}`, { status: 'fixed', note: notes[t.id] }),
                        kingdomMsg('Fixed! Tile health +15.'),
                      )
                    }
                  />
                  <DButton small label={t.unsafe ? 'Mark safe' : 'Unsafe tile'} kind={t.unsafe ? 'default' : 'danger'} onPress={() => act(() => api.patch(`/dashboard/treasures/${t.id}`, { mark_unsafe: !t.unsafe }), t.unsafe ? 'Tile marked safe.' : 'Tile marked unsafe.')} />
                </View>
              </View>
            ))}
          </View>
        </Panel>

        <Panel
          title="Coverage experiment (simulation)"
          right={
            <View style={styles.row}>
              {(['coverage_pct', 'median_age_days', 'confirmed_pct'] as const).map((m) => (
                <DButton key={m} small label={{ coverage_pct: 'Coverage %', median_age_days: 'Median data age', confirmed_pct: 'Confirmed %' }[m]} kind={metric === m ? 'active' : 'default'} onPress={() => setMetric(m)} />
              ))}
            </View>
          }
        >
          {experiment.data ? (
            <>
              <DText v="small">
                This is a SIMULATION on the real Coimbra tile network, not real-world results. Same players and same number of checks per day in each
                world. Only the way players choose where to go is different.
              </DText>
              <LineChart
                series={[
                  { id: 'sr', label: 'StreamRealm', color: d.s1, values: experiment.data.worlds.streamrealm[metric] },
                  { id: 'base', label: 'Normal app', color: d.s2, values: experiment.data.worlds.baseline[metric] },
                  { id: 'sr_half', label: 'StreamRealm, 50% players', color: d.s3, values: experiment.data.worlds.streamrealm_half[metric], dashed: true },
                  { id: 'base_half', label: 'Normal app, 50% players', color: d.s2, values: experiment.data.worlds.baseline_half[metric], dashed: true },
                ]}
                yMax={metric === 'median_age_days' ? undefined : 100}
                yLabel={{ coverage_pct: '% of tiles checked in last 14 days', median_age_days: 'median days since last check', confirmed_pct: '% checks confirmed by another player' }[metric]}
                format={(v) => (metric === 'median_age_days' ? `${v.toFixed(0)}d` : `${Math.round(v)}%`)}
              />
              <View style={styles.row}>
                {Object.entries(experiment.data.summary).map(([key, v]) => (
                  <View key={key} style={styles.sumItem}>
                    <DText v="label">{key}</DText>
                    <DText v="h3">{String(v)}</DText>
                  </View>
                ))}
              </View>
              <DText v="label">Assumptions</DText>
              {experiment.data.assumptions.map((a) => (
                <DText key={a} v="small">
                  • {a}
                </DText>
              ))}
            </>
          ) : (
            <DText v="small">{experiment.isLoading ? 'Loading…' : 'No results yet. Run: python scripts/simulate_coverage.py'}</DText>
          )}
        </Panel>

        <Pressable onPress={() => openUrl(`${API_URL}/docs`)}>
          <DText v="small" style={{ textAlign: 'center', color: d.accent }}>
            API docs (OpenAPI) ›
          </DText>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12, paddingHorizontal: 24, paddingVertical: 16, backgroundColor: d.surface, borderBottomWidth: 1, borderBottomColor: d.border },
  body: { padding: 24, gap: 16, maxWidth: 1500, width: '100%', alignSelf: 'center' },
  note: { backgroundColor: '#FFF7E0', borderRadius: 8, padding: 10, color: '#5C4500' },
  toast: { backgroundColor: '#E6F4E6', borderColor: d.good, borderWidth: 1, borderRadius: 8, padding: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  kpis: { flexDirection: 'row', gap: 12 },
  kpi: { flex: 1, minWidth: 150, backgroundColor: d.surface, borderRadius: 12, borderWidth: 1, borderColor: d.border, padding: 14, gap: 4 },
  hero: { flex: 1.6, minWidth: 260, borderColor: d.accent },
  grid: { flexDirection: 'row', gap: 16, alignItems: 'stretch' },
  map: { height: 520, borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: d.border },
  sel: { gap: 4, padding: 10, borderRadius: 8, borderWidth: 1, borderColor: d.border, backgroundColor: '#F7F7F5', maxWidth: 520 },
  card: { borderWidth: 1, borderColor: d.border, borderRadius: 10, padding: 12, gap: 10, backgroundColor: '#FFFFFF' },
  ansRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  photo: { width: 96, height: 68, borderRadius: 6, backgroundColor: d.grid },
  treasures: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  treasure: { width: 340, flexGrow: 1 },
  tphoto: { width: 72, height: 72, borderRadius: 8, backgroundColor: d.grid },
  input: { borderWidth: 1, borderColor: d.border, borderRadius: 6, paddingHorizontal: 10, minHeight: 34, fontFamily: fonts.body, color: d.ink, fontSize: 13 },
  sumItem: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: '#F2F6FC', gap: 2 },
});
