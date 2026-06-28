import React, {
  createContext,
  forwardRef,
  useContext,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from 'react';
import { LayoutChangeEvent, StyleSheet, View } from 'react-native';

/**
 * Web schematic map.
 *
 * react-native-maps can't render on web (it uses codegenNativeComponent), so on
 * web this component projects geographic coordinates onto a styled dark canvas —
 * a lightweight "ops radar" rather than real streets. It implements just enough
 * of the react-native-maps surface (Marker, Polyline, MapDirections, region +
 * animateToRegion/fitToCoordinates) for the rider/driver views and the admin
 * dashboard to plot a live fleet without any extra dependency. The real
 * Google map runs on native via MapView.tsx.
 */

export const PROVIDER_GOOGLE = 'google';

type Region = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};

type Projector = (lat: number, lng: number) => { x: number; y: number };

const DEFAULT_REGION: Region = {
  latitude: 37.7749,
  longitude: -122.4194,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

const MapContext = createContext<{ project: Projector | null }>({ project: null });
const useMapContext = () => useContext(MapContext);

/** Build a uniform-scale lat/lng → x/y projector for the current region + size. */
function makeProjector(region: Region, size: { width: number; height: number }): Projector | null {
  if (size.width <= 0 || size.height <= 0) return null;

  let latD = Math.max(region.latitudeDelta || 0.01, 1e-4);
  let lngD = Math.max(region.longitudeDelta || 0.01, 1e-4);

  // Equalize degrees-per-pixel on both axes so markers aren't stretched.
  const aspect = size.width / size.height;
  if (lngD / latD < aspect) lngD = latD * aspect;
  else latD = lngD / aspect;

  const latMax = region.latitude + latD / 2;
  const latMin = region.latitude - latD / 2;
  const lngMin = region.longitude - lngD / 2;
  const lngMax = region.longitude + lngD / 2;

  return (lat: number, lng: number) => ({
    x: ((lng - lngMin) / (lngMax - lngMin)) * size.width,
    y: ((latMax - lat) / (latMax - latMin)) * size.height, // invert: north = top
  });
}

// ─── Marker ──────────────────────────────────────────────────────────────────
export const Marker = ({ coordinate, children }: any) => {
  const { project } = useMapContext();
  if (!project || !coordinate) return null;
  const { x, y } = project(coordinate.latitude, coordinate.longitude);
  // 0×0 centering box: children overflow centered on (x, y).
  return <View style={[styles.markerAnchor, { left: x, top: y }]}>{children}</View>;
};

// ─── Line segment (one straight leg of a route) ───────────────────────────────
function Segment({
  x1, y1, x2, y2, color, width,
}: { x1: number; y1: number; x2: number; y2: number; color: string; width: number }) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = Math.sqrt(dx * dx + dy * dy);
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;
  return (
    <View
      style={{
        position: 'absolute',
        left: midX - length / 2,
        top: midY - width / 2,
        width: length,
        height: width,
        borderRadius: width / 2,
        backgroundColor: color,
        transform: [{ rotateZ: `${angle}deg` }],
      }}
    />
  );
}

// ─── Polyline ──────────────────────────────────────────────────────────────────
export const Polyline = ({ coordinates, strokeColor = '#00D4FF', strokeWidth = 4 }: any) => {
  const { project } = useMapContext();
  if (!project || !coordinates || coordinates.length < 2) return null;
  const pts = coordinates.map((c: any) => project(c.latitude, c.longitude));
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {pts.slice(1).map((p: any, i: number) => (
        <Segment
          key={i}
          x1={pts[i].x}
          y1={pts[i].y}
          x2={p.x}
          y2={p.y}
          color={strokeColor}
          width={strokeWidth}
        />
      ))}
    </View>
  );
};

// ─── MapDirections (straight-line stand-in; no Directions API on web) ──────────
export const MapDirections = ({ origin, destination, strokeColor = '#00D4FF', strokeWidth = 4, onReady }: any) => {
  const { project } = useMapContext();
  useEffect(() => {
    if (origin && destination && onReady) {
      onReady({ coordinates: [origin, destination], distance: 0, duration: 0 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [origin?.latitude, origin?.longitude, destination?.latitude, destination?.longitude]);

  if (!project || !origin || !destination) return null;
  const a = project(origin.latitude, origin.longitude);
  const b = project(destination.latitude, destination.longitude);
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Segment x1={a.x} y1={a.y} x2={b.x} y2={b.y} color={strokeColor} width={strokeWidth} />
    </View>
  );
};

// ─── Faint reference grid ──────────────────────────────────────────────────────
function Grid({ width, height }: { width: number; height: number }) {
  const step = 64;
  const cols = Math.ceil(width / step);
  const rows = Math.ceil(height / step);
  const lines = [];
  for (let i = 1; i < cols; i++) {
    lines.push(<View key={`v${i}`} style={[styles.gridLine, { left: i * step, top: 0, bottom: 0, width: 1 }]} />);
  }
  for (let j = 1; j < rows; j++) {
    lines.push(<View key={`h${j}`} style={[styles.gridLine, { top: j * step, left: 0, right: 0, height: 1 }]} />);
  }
  return <View style={StyleSheet.absoluteFill} pointerEvents="none">{lines}</View>;
}

// ─── MapView ────────────────────────────────────────────────────────────────────
const MapView = forwardRef((props: any, ref: any) => {
  const [region, setRegion] = useState<Region>(
    props.region || props.initialRegion || DEFAULT_REGION
  );
  const [size, setSize] = useState({ width: 0, height: 0 });

  // Follow a controlled `region` prop if provided.
  useEffect(() => {
    if (props.region) setRegion(props.region);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.region?.latitude, props.region?.longitude, props.region?.latitudeDelta, props.region?.longitudeDelta]);

  useImperativeHandle(ref, () => ({
    animateToRegion: (r: Region) => {
      if (r) setRegion(r);
    },
    fitToCoordinates: (coords: { latitude: number; longitude: number }[], opts?: any) => {
      if (!coords || coords.length === 0) return;
      let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
      coords.forEach((c) => {
        minLat = Math.min(minLat, c.latitude);
        maxLat = Math.max(maxLat, c.latitude);
        minLng = Math.min(minLng, c.longitude);
        maxLng = Math.max(maxLng, c.longitude);
      });
      setRegion({
        latitude: (minLat + maxLat) / 2,
        longitude: (minLng + maxLng) / 2,
        latitudeDelta: Math.max((maxLat - minLat) * 1.4, 0.01),
        longitudeDelta: Math.max((maxLng - minLng) * 1.4, 0.01),
      });
    },
  }));

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize((prev) => (prev.width !== width || prev.height !== height ? { width, height } : prev));
  };

  const project = useMemo(() => makeProjector(region, size), [region, size]);

  return (
    <View style={[props.style, styles.container]} onLayout={onLayout}>
      <Grid width={size.width} height={size.height} />
      <View style={styles.cornerLabel} pointerEvents="none">
        <View style={styles.cornerDot} />
      </View>
      <MapContext.Provider value={{ project }}>
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          {project ? props.children : null}
        </View>
      </MapContext.Provider>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#E9F0FB',
    overflow: 'hidden',
  },
  markerAnchor: {
    position: 'absolute',
    width: 0,
    height: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridLine: {
    position: 'absolute',
    backgroundColor: 'rgba(37,99,235,0.07)',
  },
  cornerLabel: {
    position: 'absolute',
    top: 12,
    left: 12,
  },
  cornerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
  },
});

export default MapView;
