/**
 * Light Google Maps style — clean whitish base with soft blue water,
 * matching the app's vibrant white/blue aesthetic. Shared by the main map
 * and the destination picker.
 */
export const LIGHT_MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#f4f7fc' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#6b7a92' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#ffffff' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#cdd8ec' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#4a5670' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#e9eef8' }] },
  { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#8893a8' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#d8edda' }] },
  { featureType: 'poi.park', elementType: 'labels.text.fill', stylers: [{ color: '#6aa377' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#9aa7bd' }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#e3ebf7' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#d4e0f2' }] },
  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#e9eef8' }] },
  { featureType: 'transit.line', elementType: 'geometry', stylers: [{ color: '#dbe3f1' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#cfe2ff' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#7fa8e0' }] },
];
