import { useState, useRef, useEffect } from 'react';
import { Loader } from '@googlemaps/js-api-loader';

const MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY;

export default function UbicacionPicker({ lat, lng, onSelect }) {
  const [abierto, setAbierto] = useState(false);
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);
  const geocoderRef = useRef(null);
  const [markerPos, setMarkerPos] = useState(null);
  const [direccionDisplay, setDireccionDisplay] = useState('');
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    if (!abierto || !MAPS_KEY) return;

    setCargando(true);
    const loader = new Loader({
      apiKey: MAPS_KEY,
      version: 'weekly',
      libraries: ['geocoding'],
    });

    loader.load().then(() => {
      if (!mapRef.current) return;

      const centro = lat && lng ? { lat, lng } : { lat: 4.71, lng: -74.07 };

      const mapInstance = new google.maps.Map(mapRef.current, {
        zoom: lat && lng ? 15 : 11,
        center: centro,
      });
      mapInstanceRef.current = mapInstance;
      geocoderRef.current = new google.maps.Geocoder();

      if (lat && lng) {
        const marker = new google.maps.Marker({
          position: centro,
          map: mapInstance,
          draggable: false,
        });
        markerRef.current = marker;
        setMarkerPos(centro);
        reverseGeocode(lat, lng);
      }

      mapInstance.addListener('click', (e) => {
        const pos = { lat: e.latLng.lat(), lng: e.latLng.lng() };
        if (markerRef.current) {
          markerRef.current.setMap(null);
        }
        const marker = new google.maps.Marker({
          position: pos,
          map: mapInstance,
          draggable: false,
        });
        markerRef.current = marker;
        setMarkerPos(pos);
        reverseGeocode(pos.lat, pos.lng);
      });

      setCargando(false);
    });

    return () => {
      if (markerRef.current) {
        markerRef.current.setMap(null);
        markerRef.current = null;
      }
      mapInstanceRef.current = null;
      geocoderRef.current = null;
    };
  }, [abierto]);

  function reverseGeocode(latV, lngV) {
    if (!geocoderRef.current) return;
    geocoderRef.current.geocode({ location: { lat: latV, lng: lngV } }, (results, status) => {
      if (status === 'OK' && results[0]) {
        setDireccionDisplay(results[0].formatted_address);
      } else {
        setDireccionDisplay(`${latV.toFixed(6)}, ${lngV.toFixed(6)}`);
      }
    });
  }

  function usarMiUbicacion() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((pos) => {
      const { latitude: latV, longitude: lngV } = pos.coords;
      const posObj = { lat: latV, lng: lngV };
      if (mapInstanceRef.current) {
        mapInstanceRef.current.setCenter(posObj);
        mapInstanceRef.current.setZoom(15);
        if (markerRef.current) {
          markerRef.current.setMap(null);
        }
        const marker = new google.maps.Marker({
          position: posObj,
          map: mapInstanceRef.current,
          draggable: false,
        });
        markerRef.current = marker;
        setMarkerPos(posObj);
        reverseGeocode(latV, lngV);
      }
    });
  }

  function confirmar() {
    if (!markerPos) return;
    onSelect({ lat: markerPos.lat, lng: markerPos.lng, direccion: direccionDisplay });
    setAbierto(false);
  }

  function cancelar() {
    setAbierto(false);
    setMarkerPos(null);
    setDireccionDisplay('');
  }

  if (!abierto) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        {lat && lng ? (
          <>
            <span style={{ fontSize: 13, color: '#4B5563' }}>
              📍 {direccionDisplay || `${lat.toFixed(5)}, ${lng.toFixed(5)}`}
            </span>
            <button
              type="button"
              onClick={() => setAbierto(true)}
              style={{
                fontSize: 12, padding: '4px 12px', borderRadius: 8,
                border: '1px solid var(--cream-border)', background: '#F8F8F0',
                cursor: 'pointer', color: '#374151',
              }}
            >
              Cambiar ubicación
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setAbierto(true)}
            style={{
              fontSize: 13, padding: '8px 16px', borderRadius: 10,
              border: '1px solid var(--cream-border)', background: '#F8F8F0',
              cursor: 'pointer', color: '#374151', width: '100%', textAlign: 'left',
            }}
          >
            Seleccionar ubicación en mapa
          </button>
        )}
      </div>
    );
  }

  return (
    <div style={{
      border: '1px solid var(--cream-border)', borderRadius: 12,
      background: '#F8F8F0', padding: 12, display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <button
        type="button"
        onClick={usarMiUbicacion}
        style={{
          alignSelf: 'flex-start', fontSize: 13, padding: '6px 14px', borderRadius: 8,
          border: '1px solid var(--cream-border)', background: '#fff', cursor: 'pointer', color: '#374151',
        }}
      >
        📍 Usar mi ubicación
      </button>

      <div
        ref={mapRef}
        style={{ height: 300, borderRadius: 8, background: '#E5E7EB' }}
      >
        {cargando && (
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6B7280', fontSize: 13 }}>
            Cargando mapa...
          </div>
        )}
      </div>

      <input
        type="text"
        disabled
        value={direccionDisplay}
        placeholder="Selecciona un punto en el mapa"
        style={{
          width: '100%', padding: '7px 10px', borderRadius: 8,
          border: '1px solid var(--cream-border)', background: '#fff', fontSize: 13,
          color: '#374151', boxSizing: 'border-box',
        }}
      />

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button
          type="button"
          onClick={cancelar}
          style={{
            fontSize: 13, padding: '6px 14px', borderRadius: 8,
            border: '1px solid var(--cream-border)', background: '#fff', cursor: 'pointer', color: '#6B7280',
          }}
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={confirmar}
          disabled={!markerPos}
          style={{
            fontSize: 13, padding: '6px 16px', borderRadius: 8,
            border: 'none', background: markerPos ? '#1a56db' : '#9CA3AF',
            cursor: markerPos ? 'pointer' : 'not-allowed', color: '#fff',
          }}
        >
          Confirmar
        </button>
      </div>
    </div>
  );
}
