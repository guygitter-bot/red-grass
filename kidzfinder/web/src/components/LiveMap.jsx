import { useEffect, useRef } from 'react';
import L from 'leaflet';

// מפה חיה: מציגה את הילדים (סמן עם אימוג'י) ואת המקומות (עיגול). מתעדכנת בלי לבנות מחדש.
export default function LiveMap({ children = [], places = [], follow }) {
  const elRef = useRef(null);
  const mapRef = useRef(null);
  const kidLayers = useRef(new Map()); // id -> { marker }
  const placeLayers = useRef(new Map());
  const didFit = useRef(false);

  // בניית המפה פעם אחת
  useEffect(() => {
    if (mapRef.current || !elRef.current) return;
    const map = L.map(elRef.current, { zoomControl: true, attributionControl: true }).setView([32.0853, 34.7818], 15);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap',
    }).addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // עדכון מקומות (עיגולים)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const seen = new Set();
    for (const p of places) {
      seen.add(p.id);
      let layer = placeLayers.current.get(p.id);
      if (!layer) {
        layer = L.circle([p.lat, p.lng], {
          radius: p.radius || 150,
          color: '#4f46e5',
          weight: 1.5,
          fillColor: '#4f46e5',
          fillOpacity: 0.1,
        }).addTo(map);
        layer.bindTooltip(p.name, { permanent: true, direction: 'center', className: 'place-label' });
        placeLayers.current.set(p.id, layer);
      } else {
        layer.setLatLng([p.lat, p.lng]).setRadius(p.radius || 150);
      }
    }
    for (const [id, layer] of placeLayers.current) {
      if (!seen.has(id)) {
        layer.remove();
        placeLayers.current.delete(id);
      }
    }
  }, [places]);

  // עדכון מיקומי הילדים
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const seen = new Set();
    const points = [];
    for (const c of children) {
      if (!c.live) continue;
      seen.add(c.id);
      points.push([c.live.lat, c.live.lng]);
      const sos = c.live.sos;
      const icon = L.divIcon({
        className: '',
        html: `<div class="kid-pin${sos ? ' sos' : ''}">🧒</div>`,
        iconSize: [42, 42],
        iconAnchor: [21, 21],
      });
      let layer = kidLayers.current.get(c.id);
      if (!layer) {
        const marker = L.marker([c.live.lat, c.live.lng], { icon }).addTo(map);
        marker.bindPopup(c.name);
        kidLayers.current.set(c.id, marker);
      } else {
        layer.setLatLng([c.live.lat, c.live.lng]);
        layer.setIcon(icon);
      }
    }
    for (const [id, layer] of kidLayers.current) {
      if (!seen.has(id)) {
        layer.remove();
        kidLayers.current.delete(id);
      }
    }
    // התמקדות ראשונית על הילדים
    if (points.length && !didFit.current) {
      didFit.current = true;
      if (points.length === 1) map.setView(points[0], 16);
      else map.fitBounds(points, { padding: [40, 40] });
    }
    // מעקב רציף אחרי ילד נבחר
    if (follow) {
      const c = children.find((x) => x.id === follow && x.live);
      if (c) map.panTo([c.live.lat, c.live.lng], { animate: true, duration: 0.5 });
    }
  }, [children, follow]);

  return <div ref={elRef} className="h-full w-full" />;
}
