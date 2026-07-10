// Webb-mock för react-native-maps (native-only) — visar en platshållare.
import { forwardRef, useImperativeHandle } from 'react';
import { View, Text } from 'react-native';

const MapView = forwardRef(function MapView({ style, children }, ref) {
  useImperativeHandle(ref, () => ({
    animateToRegion: () => {},
    animateCamera: () => {},
    fitToCoordinates: () => {},
  }));
  return (
    <View
      style={[
        { backgroundColor: '#E6F4EF', alignItems: 'center', justifyContent: 'center', minHeight: 160 },
        style,
      ]}
    >
      <Text style={{ fontSize: 40 }}>🗺️</Text>
      <Text style={{ marginTop: 8, color: '#047857', fontWeight: '600', fontSize: 14 }}>
        Live-karta visas i mobilappen
      </Text>
      <View style={{ display: 'none' }}>{children}</View>
    </View>
  );
});

export default MapView;
export const Marker = () => null;
export const Polyline = () => null;
export const PROVIDER_GOOGLE = 'google';
