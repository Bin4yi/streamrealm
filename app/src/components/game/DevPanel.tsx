import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Card, Chip, GameButton, Row, Txt } from '@/components/ui/kit';
import { api, useStorm } from '@/lib/api';
import { useGame } from '@/lib/store';
import { colors, fonts, radius, space } from '@/lib/theme';

const WARP_MAX = 30;

function WarpSlider({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const width = useRef(1);
  const setFromX = (x: number) => onChange(Math.round(Math.max(0, Math.min(1, x / width.current)) * WARP_MAX));
  return (
    <View
      onLayout={(e) => (width.current = e.nativeEvent.layout.width)}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderGrant={(e) => setFromX(e.nativeEvent.locationX)}
      onResponderMove={(e) => setFromX(e.nativeEvent.locationX)}
      style={styles.sliderHit}
      accessibilityRole="adjustable"
      accessibilityLabel={`Time warp ${value} days`}
    >
      <View style={styles.sliderTrack} pointerEvents="none">
        <View style={[styles.sliderFill, { width: `${(value / WARP_MAX) * 100}%` }]} />
      </View>
      <View pointerEvents="none" style={[styles.sliderKnob, { left: `${(value / WARP_MAX) * 100}%` }]} />
    </View>
  );
}

export function DevPanel() {
  const qc = useQueryClient();
  const g = useGame();
  const storm = useStorm();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const refresh = () => qc.invalidateQueries();
  const run = async (key: string, fn: () => Promise<unknown>, done?: string) => {
    setBusy(key);
    setMsg(null);
    try {
      await fn();
      if (done) setMsg(done);
      await refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(null);
    }
  };

  // Bots act every 20 s while auto-tick is on.
  useEffect(() => {
    if (!g.autoTick) return;
    const t = setInterval(() => {
      api.post('/dev/bots/tick').then(refresh).catch(() => {});
    }, 20_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [g.autoTick]);

  if (!g.devPanelEnabled) return null;

  if (!g.devPanelOpen) {
    return (
      <Pressable style={styles.fab} onPress={() => g.set({ devPanelOpen: true })} accessibilityRole="button" accessibilityLabel="Open Dev Panel">
        <Txt style={{ fontSize: 22 }}>🛠</Txt>
      </Pressable>
    );
  }

  const forced = storm.data?.forced;
  return (
    <Card style={styles.panel} padded={false}>
      <Row style={styles.header}>
        <Txt style={{ fontSize: 18 }}>🛠</Txt>
        <Txt v="h3" style={{ flex: 1 }}>
          Dev Panel
        </Txt>
        <Pressable onPress={() => g.set({ devPanelOpen: false })} accessibilityLabel="Close Dev Panel" hitSlop={10}>
          <Ionicons name="close" size={22} color={colors.textMuted} />
        </Pressable>
      </Row>
      <ScrollView style={{ maxHeight: 380 }} contentContainerStyle={{ padding: space.md, gap: space.md }}>
        <View style={{ gap: 6 }}>
          <Txt v="tiny">Location</Txt>
          <Row style={{ flexWrap: 'wrap' }}>
            <Chip label="Teleport on click" icon="📍" active={g.teleportMode} onPress={() => g.set({ teleportMode: !g.teleportMode })} />
            <Chip label="Real GPS" icon="🛰️" active={g.realGps} onPress={() => g.set({ realGps: !g.realGps })} />
          </Row>
          <Txt v="small">
            {Platform.OS === 'web' ? 'Walk with W A S D or the arrow keys. Hold Shift to run.' : 'Tap the map to teleport.'}
          </Txt>
          {g.position && (
            <Txt v="small" style={{ fontFamily: fonts.bodyBold }}>
              {g.position.lat.toFixed(5)}, {g.position.lon.toFixed(5)}
            </Txt>
          )}
        </View>

        <View style={{ gap: 6 }}>
          <Row>
            <Txt v="tiny" style={{ flex: 1 }}>
              Time Warp
            </Txt>
            <Txt v="label" style={{ color: colors.gold }}>
              +{g.timeWarpDays} days
            </Txt>
          </Row>
          <WarpSlider value={g.timeWarpDays} onChange={(v) => g.set({ timeWarpDays: v })} />
          <Row style={{ flexWrap: 'wrap', gap: 6 }}>
            {[0, 5, 8, 15, 30].map((d) => (
              <Chip key={d} label={`+${d}d`} active={g.timeWarpDays === d} onPress={() => g.set({ timeWarpDays: d })} />
            ))}
          </Row>
        </View>

        <View style={{ gap: 6 }}>
          <Txt v="tiny">Storm Quest {storm.data ? `(now ${storm.data.active ? 'ON' : 'off'})` : ''}</Txt>
          <Row style={{ flexWrap: 'wrap', gap: 6 }}>
            <Chip label="Auto (weather)" active={forced == null} onPress={() => run('storm', () => api.post('/dev/storm?on=auto'))} />
            <Chip label="Force ON" icon="⛈️" active={forced === true} color={colors.disputed} onPress={() => run('storm', () => api.post('/dev/storm?on=true'))} />
            <Chip label="Force OFF" active={forced === false} onPress={() => run('storm', () => api.post('/dev/storm?on=false'))} />
          </Row>
        </View>

        <View style={{ gap: 6 }}>
          <Txt v="tiny">Photos</Txt>
          <Chip label="Use demo photos in checks" icon="🖼️" active={g.useDemoPhotos} onPress={() => g.set({ useDemoPhotos: !g.useDemoPhotos })} />
        </View>

        <View style={{ gap: 6 }}>
          <Txt v="tiny">Bots</Txt>
          <Row style={{ flexWrap: 'wrap', gap: 6 }}>
            <GameButton
              label="Bot activity"
              icon="people"
              kind="primary"
              loading={busy === 'tick'}
              onPress={() => run('tick', () => api.post('/dev/bots/tick'), 'Bots made new moves.')}
            />
            <Chip label="Auto every 20 s" icon="⏱️" active={g.autoTick} onPress={() => g.set({ autoTick: !g.autoTick })} />
          </Row>
        </View>

        <Row style={{ flexWrap: 'wrap', gap: 6 }}>
          <GameButton label="Scientist dashboard" icon="analytics" kind="ghost" onPress={() => router.push('/dashboard')} />
          <GameButton
            label="Reset demo"
            icon="refresh-circle"
            kind="danger"
            loading={busy === 'reset'}
            onPress={() => run('reset', () => api.post('/dev/reset'), 'Demo world reset.')}
          />
        </Row>
        {msg && <Txt v="small">{msg}</Txt>}
      </ScrollView>
    </Card>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    left: space.md,
    bottom: 120,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(14,42,51,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  panel: { position: 'absolute', left: space.md, right: space.md, bottom: 150, borderRadius: radius.lg },
  header: { paddingHorizontal: space.md, paddingTop: space.md, paddingBottom: space.sm, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)' },
  sliderHit: { height: 32, justifyContent: 'center' },
  sliderTrack: { height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.15)', overflow: 'hidden' },
  sliderFill: { height: 8, backgroundColor: colors.gold },
  sliderKnob: { position: 'absolute', width: 22, height: 22, marginLeft: -11, borderRadius: 11, backgroundColor: colors.gold, borderWidth: 3, borderColor: colors.white, top: 5 },
});
