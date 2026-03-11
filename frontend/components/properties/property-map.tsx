"use client";

import { useEffect, useRef, useState } from "react";

type MapMarker = {
  lat: number;
  lng: number;
  title: string;
  popup?: string;
};

type PropertyMapProps = {
  markers: MapMarker[];
  center?: [number, number];
  zoom?: number;
  height?: string;
};

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    L: any;
  }
}

/** Load Leaflet CSS + JS from CDN once */
function useLeaflet(callback: (L: any) => void) {
  const loaded = useRef(false);

  useEffect(() => {
    if (loaded.current) {
      if (window.L) callback(window.L);
      return;
    }
    loaded.current = true;

    // Load CSS
    if (!document.querySelector('link[href*="leaflet"]')) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }

    // Load JS
    if (!window.L) {
      const script = document.createElement("script");
      script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      script.onload = () => {
        if (window.L) callback(window.L);
      };
      document.head.appendChild(script);
    } else {
      callback(window.L);
    }
  }, [callback]);
}

// Tanzania center coordinates
const TANZANIA_CENTER: [number, number] = [-6.369, 34.889];
const DEFAULT_ZOOM = 6;

export function PropertyMap({ markers, center, zoom, height = "320px" }: PropertyMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const [ready, setReady] = useState(false);

  useLeaflet((L) => {
    if (!mapRef.current || mapInstance.current) return;

    const map = L.map(mapRef.current).setView(
      center || TANZANIA_CENTER,
      zoom || DEFAULT_ZOOM
    );

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 18,
    }).addTo(map);

    mapInstance.current = map;
    setReady(true);
  });

  // Update markers when they change
  useEffect(() => {
    if (!ready || !mapInstance.current || !window.L) return;
    const L = window.L;
    const map = mapInstance.current;

    // Clear existing markers
    map.eachLayer((layer: { remove: () => void; _url?: string }) => {
      if (!("_url" in layer)) layer.remove();
    });

    // Re-add tile layer
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 18,
    }).addTo(map);

    // Add markers
    if (markers.length > 0) {
      const bounds: [number, number][] = [];
      markers.forEach(m => {
        const marker = L.marker([m.lat, m.lng]).addTo(map);
        if (m.popup) marker.bindPopup(m.popup);
        else marker.bindPopup(`<strong>${m.title}</strong>`);
        bounds.push([m.lat, m.lng]);
      });

      if (bounds.length === 1) {
        map.setView(bounds[0], 14);
      } else if (bounds.length > 1) {
        map.fitBounds(bounds as [[number, number], [number, number]], { padding: [40, 40] });
      }
    }
  }, [markers, ready]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, []);

  return (
    <div
      ref={mapRef}
      style={{
        height,
        width: "100%",
        borderRadius: "var(--radius-lg)",
        border: "1px solid var(--color-border)",
        background: "var(--color-bg-subtle)",
        overflow: "hidden",
      }}
    />
  );
}
