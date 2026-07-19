import { useEffect, useRef, useMemo } from 'react';
import { Loader } from '@googlemaps/js-api-loader';
import styles from './MapaCamiones.module.css';

const MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY;

export default function MapaCamiones({ rutas, camiones, clientes }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);

  const camionesPosiciones = useMemo(() => {
    return rutas
      .map((ruta) => {
        const paradaActual = ruta.paradas?.find((p) => p.estado === 'pendiente');
        const cliente = paradaActual
          ? clientes.find((c) => c.id === paradaActual.clienteId)
          : null;

        if (!cliente?.lat || !cliente?.lng) return null;

        const camion = camiones.find((c) => c.id === ruta.camionId);
        return {
          lat: cliente.lat,
          lng: cliente.lng,
          camion: camion?.nombre || ruta.camionId,
          estado: paradaActual?.estado || 'pendiente',
        };
      })
      .filter(Boolean);
  }, [rutas, camiones, clientes]);

  useEffect(() => {
    if (!MAPS_KEY || camionesPosiciones.length === 0) return;

    const loader = new Loader({
      apiKey: MAPS_KEY,
      version: 'weekly',
    });

    loader.load().then(() => {
      if (!mapRef.current) return;

      const mapInstance = new google.maps.Map(mapRef.current, {
        zoom: 13,
        center: { lat: 4.711, lng: -74.0721 },
      });
      mapInstanceRef.current = mapInstance;

      markersRef.current.forEach((m) => m.setMap(null));
      markersRef.current = [];

      const bounds = new google.maps.LatLngBounds();
      camionesPosiciones.forEach((pos) => {
        const marker = new google.maps.Marker({
          position: { lat: pos.lat, lng: pos.lng },
          map: mapInstance,
          title: pos.camion,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 15,
            fillColor: pos.estado === 'visitado' ? '#3D8873' : '#7E8E99',
            fillOpacity: 1,
            strokeColor: '#FFFFFF',
            strokeWeight: 2,
          },
          label: {
            text: pos.camion.split(' ').pop(),
            color: '#FFFFFF',
            fontSize: '12px',
            fontWeight: 'bold',
          },
        });
        markersRef.current.push(marker);
        bounds.extend(marker.getPosition());
      });

      if (camionesPosiciones.length > 1) {
        mapInstance.fitBounds(bounds);
      }
    });

    return () => {
      markersRef.current.forEach((m) => m.setMap(null));
    };
  }, [camionesPosiciones]);

  if (!MAPS_KEY) {
    return <div className={styles.error}>⚠️ VITE_GOOGLE_MAPS_KEY no configurada</div>;
  }

  if (camionesPosiciones.length === 0) {
    return <div className={styles.empty}>No hay camiones activos hoy</div>;
  }

  return <div ref={mapRef} className={styles.mapa} />;
}
