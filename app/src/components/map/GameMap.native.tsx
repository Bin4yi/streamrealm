import { useEffect, useMemo, useRef } from 'react';
import { Text, View } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';

import { colors, teams } from '@/lib/theme';

import { tileStyle, type GameMapProps } from './types';

function zoomToDelta(zoom: number) {
  return 360 / Math.pow(2, zoom);
}

export default function GameMap(props: GameMapProps) {
  const mapRef = useRef<MapView>(null);
  const mode = props.mode ?? 'game';
  const lines = useMemo(
    () =>
      (props.tiles?.features ?? []).map((f) => {
        const { color, visible } = tileStyle(f, mode, props.filter ?? 'all', props.myTeam);
        return { f, color, visible };
      }),
    [props.tiles, mode, props.filter, props.myTeam],
  );

  useEffect(() => {
    if (props.followPosition && props.position) {
      mapRef.current?.animateCamera({ center: { latitude: props.position.lat, longitude: props.position.lon } }, { duration: 500 });
    }
  }, [props.position, props.followPosition]);

  const delta = zoomToDelta(props.zoom);
  return (
    <View style={[{ flex: 1 }, props.style]}>
      <MapView
        ref={mapRef}
        style={{ flex: 1 }}
        initialRegion={{ latitude: props.center[1], longitude: props.center[0], latitudeDelta: delta, longitudeDelta: delta }}
        onPress={(e) => props.onMapPress?.({ lat: e.nativeEvent.coordinate.latitude, lon: e.nativeEvent.coordinate.longitude })}
        showsPointsOfInterests={false}
        toolbarEnabled={false}
      >
        {lines.map(({ f, color, visible }) => {
          const coords = f.geometry.coordinates.map(([lon, lat]) => ({ latitude: lat, longitude: lon }));
          const highlighted = f.id === props.highlightTileId || f.id === props.selectedTileId;
          return (
            <Polyline
              key={f.id}
              coordinates={coords}
              strokeColor={visible ? color : `${color}33`}
              strokeWidth={highlighted ? 12 : 8}
              lineDashPattern={f.properties.state === 'fog' ? [10, 8] : undefined}
              tappable
              onPress={() => props.onTilePress?.(f.id)}
            />
          );
        })}
        {lines
          .filter(({ f }) => f.properties.state === 'disputed' || f.properties.treasures > 0)
          .map(({ f }) => (
            <Marker
              key={`m-${f.id}`}
              coordinate={{ latitude: f.properties.center[1], longitude: f.properties.center[0] }}
              onPress={() => props.onTilePress?.(f.id)}
            >
              <Text style={{ fontSize: 18 }}>{f.properties.state === 'disputed' ? '⚔️' : '💎'}</Text>
            </Marker>
          ))}
        {props.position && (
          <Marker coordinate={{ latitude: props.position.lat, longitude: props.position.lon }} anchor={{ x: 0.5, y: 0.5 }}>
            <View
              style={{
                width: 22,
                height: 22,
                borderRadius: 11,
                borderWidth: 3,
                borderColor: colors.white,
                backgroundColor: props.myTeam ? teams[props.myTeam].color : colors.water,
              }}
            />
          </Marker>
        )}
      </MapView>
    </View>
  );
}
