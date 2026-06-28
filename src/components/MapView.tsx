import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import MapViewDirections from 'react-native-maps-directions';

/**
 * Native map surface.
 *
 * Re-exports react-native-maps primitives plus the directions component behind
 * a single import so screens never touch the native-only modules directly. The
 * web counterpart (MapView.web.tsx) provides inert shims for the same exports.
 */
export { Marker, Polyline, PROVIDER_GOOGLE };
export const MapDirections = MapViewDirections;
export default MapView;
