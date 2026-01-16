import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, MapPin, Calendar } from 'lucide-react';
import { useAuth } from '../src/auth/AuthProvider';
import { fetchCommercialData } from '../lib/commercial';
import { formatCurrency } from '../lib/utils';

type Period = 'quinzenal' | 'mensal' | 'trimestral' | 'semestral' | 'anual' | 'personalizado';

type GeoPoint = {
  name: string;
  cep: string;
  lat: number;
  lng: number;
  total: number;
  atendimentos: number;
};

type LeafletModule = any;

const GEO_CACHE_KEY = 'onefincGeoCache';
let leafletPromise: Promise<LeafletModule> | null = null;

const loadLeaflet = () => {
  if (typeof window === 'undefined') return Promise.reject(new Error('window indisponivel'));
  if ((window as any).L) return Promise.resolve((window as any).L);
  if (leafletPromise) return leafletPromise;
  leafletPromise = new Promise((resolve, reject) => {
    const existingLink = document.querySelector('link[data-leaflet]');
    if (!existingLink) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      link.setAttribute('data-leaflet', 'true');
      document.head.appendChild(link);
    }

    const existingScript = document.querySelector('script[data-leaflet]');
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve((window as any).L));
      existingScript.addEventListener('error', () => reject(new Error('Falha ao carregar Leaflet.')));
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.async = true;
    script.setAttribute('data-leaflet', 'true');
    script.onload = () => resolve((window as any).L);
    script.onerror = () => reject(new Error('Falha ao carregar Leaflet.'));
    document.body.appendChild(script);
  });
  return leafletPromise;
};

const formatDate = (d: Date) => d.toISOString().slice(0, 10);

const rangeFromPeriod = (period: Period) => {
  const end = new Date();
  const start = new Date();
  switch (period) {
    case 'quinzenal':
      start.setDate(start.getDate() - 15);
      break;
    case 'mensal':
      start.setMonth(start.getMonth() - 1);
      break;
    case 'trimestral':
      start.setMonth(start.getMonth() - 3);
      break;
    case 'semestral':
      start.setMonth(start.getMonth() - 6);
      break;
    case 'anual':
      start.setFullYear(start.getFullYear() - 1);
      break;
    default:
      break;
  }
  return { from: formatDate(start), to: formatDate(end) };
};

const cleanCep = (cep: string) => cep.replace(/\D/g, '');

const geocodeCep = async (
  cep: string,
  cacheRef: React.MutableRefObject<Record<string, { lat: number; lng: number }>>
) => {
  const cleaned = cleanCep(cep);
  if (cleaned.length < 5) return null;
  if (cacheRef.current[cleaned]) return cacheRef.current[cleaned];
  const url = `https://nominatim.openstreetmap.org/search?postalcode=${encodeURIComponent(cleaned)}&country=Brazil&format=json&limit=1`;
  try {
    const res = await fetch(url, { headers: { 'Accept-Language': 'pt-BR' } });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || !data[0]) return null;
    const geo = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    cacheRef.current[cleaned] = geo;
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(GEO_CACHE_KEY, JSON.stringify(cacheRef.current));
    }
    return geo;
  } catch {
    return null;
  }
};

const CommercialGeo: React.FC = () => {
  const { effectiveClinicId, isAdmin, selectedClinicId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [points, setPoints] = useState<GeoPoint[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<Period>('mensal');
  const [{ from, to }, setRange] = useState(() => rangeFromPeriod('mensal'));
  const [markerSize, setMarkerSize] = useState(10);
  const [scaleByValue, setScaleByValue] = useState(true);
  const [showNames, setShowNames] = useState(true);
  const [showValues, setShowValues] = useState(true);
  const [showCounts, setShowCounts] = useState(false);
  const [mapReady, setMapReady] = useState(false);

  const mapRef = useRef<any>(null);
  const markersRef = useRef<any>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const cacheRef = useRef<Record<string, { lat: number; lng: number }>>({});

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const cached = window.localStorage.getItem(GEO_CACHE_KEY);
      if (cached) cacheRef.current = JSON.parse(cached);
    } catch {
      cacheRef.current = {};
    }
  }, []);

  const handlePeriodChange = (next: Period) => {
    setPeriod(next);
    if (next === 'personalizado') return;
    setRange(rangeFromPeriod(next));
  };

  const handleRangeChange = (nextFrom: string, nextTo: string) => {
    setPeriod('personalizado');
    setRange({ from: nextFrom, to: nextTo });
  };

  useEffect(() => {
    const load = async () => {
      if (!effectiveClinicId && !isAdmin) return;
      setLoading(true);
      setError(null);
      try {
        const data = await fetchCommercialData({
          clinicId: isAdmin ? selectedClinicId || undefined : effectiveClinicId || undefined,
          from: from || undefined,
          to: to || undefined,
        });

        const normalizeName = (name: string) => name.trim().toLowerCase();
        const totalsByName = new Map<string, { total: number; atendimentos: number }>();
        data.revenues.forEach((rev) => {
          const name = (rev.paciente || 'Sem nome').trim() || 'Sem nome';
          const key = normalizeName(name);
          const current = totalsByName.get(key) || { total: 0, atendimentos: 0 };
          const value = Number(rev.valor_liquido ?? rev.valor ?? 0);
          totalsByName.set(key, {
            total: current.total + (isFinite(value) ? value : 0),
            atendimentos: current.atendimentos + 1,
          });
        });

        const targets = data.customers
          .filter((customer) => customer.name && customer.cep)
          .map((customer) => {
            const key = normalizeName(customer.name || '');
            const stats = totalsByName.get(key) || { total: 0, atendimentos: 0 };
            return {
              name: customer.name || 'Sem nome',
              cep: customer.cep || '',
              total: stats.total,
              atendimentos: stats.atendimentos,
            };
          })
          .filter((target) => target.cep);

        const uniqueCeps = Array.from(new Set(targets.map((t) => cleanCep(t.cep)).filter(Boolean)));
        const geoMap = new Map<string, { lat: number; lng: number }>();
        for (const cep of uniqueCeps) {
          const geo = await geocodeCep(cep, cacheRef);
          if (geo) geoMap.set(cep, geo);
        }

        const nextPoints = targets
          .map((t) => {
            const geo = geoMap.get(cleanCep(t.cep));
            if (!geo) return null;
            return {
              name: t.name,
              cep: t.cep,
              lat: geo.lat,
              lng: geo.lng,
              total: t.total,
              atendimentos: t.atendimentos,
            };
          })
          .filter(Boolean) as GeoPoint[];

        setPoints(nextPoints);
      } catch (err: any) {
        setError(err.message || 'Erro ao carregar dados do mapa.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [effectiveClinicId, isAdmin, selectedClinicId, from, to]);

  useEffect(() => {
    if (loading || error) return;
    let active = true;
    loadLeaflet()
      .then((L) => {
        if (!active || !mapContainerRef.current) return;
        if (!mapRef.current) {
          mapRef.current = L.map(mapContainerRef.current, { zoomControl: true });
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap contributors',
            maxZoom: 18,
          }).addTo(mapRef.current);
          markersRef.current = L.layerGroup().addTo(mapRef.current);
        }
        mapRef.current.invalidateSize();
        setMapReady(true);
      })
      .catch(() => {
        setError('Não foi possível carregar o mapa.');
      });

    return () => {
      active = false;
    };
  }, [loading, error]);

  const maxValue = useMemo(() => {
    const max = points.reduce((acc, p) => Math.max(acc, p.total), 0);
    return max > 0 ? max : 1;
  }, [points]);

  useEffect(() => {
    let active = true;
    if (!mapReady) return;
    loadLeaflet().then((L) => {
      if (!active || !mapRef.current || !markersRef.current) return;
      markersRef.current.clearLayers();
      const bounds: Array<[number, number]> = [];
      points.forEach((p) => {
        const radius = scaleByValue ? markerSize + (p.total / maxValue) * markerSize : markerSize;
        const marker = L.circleMarker([p.lat, p.lng], {
          radius,
          color: '#0284c7',
          fillColor: '#38bdf8',
          fillOpacity: 0.75,
          weight: 1,
        });
        let tooltip = '';
        if (showNames) tooltip += `<strong>${p.name}</strong>`;
        if (showValues) tooltip += `${tooltip ? '<br/>' : ''}Consumo: ${formatCurrency(p.total)}`;
        if (showCounts) tooltip += `${tooltip ? '<br/>' : ''}Atendimentos: ${p.atendimentos}`;
        if (tooltip) marker.bindTooltip(tooltip, { direction: 'top', opacity: 0.9, sticky: true });
        marker.addTo(markersRef.current);
        bounds.push([p.lat, p.lng]);
      });
      if (bounds.length) {
        mapRef.current.fitBounds(bounds, { padding: [40, 40] });
      } else {
        mapRef.current.setView([-14.235, -51.925], 4);
      }
    });
    return () => {
      active = false;
    };
  }, [points, markerSize, scaleByValue, showNames, showValues, showCounts, maxValue, mapReady]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-800">Comercial • Geolocalizacao</h1>
      <p className="text-gray-500">Clientes destacados por CEP, com consumo e recorrencia no periodo.</p>

      <div className="bg-white border border-gray-100 rounded-xl shadow-sm p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <div className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white">
            <Calendar size={16} /> Periodo:
            <select value={period} onChange={(e) => handlePeriodChange(e.target.value as Period)} className="text-sm bg-transparent focus:outline-none">
              <option value="quinzenal">Ultimos 15 dias</option>
              <option value="mensal">Ultimos 30 dias</option>
              <option value="trimestral">Ultimos 3 meses</option>
              <option value="semestral">Ultimos 6 meses</option>
              <option value="anual">Ultimos 12 meses</option>
              <option value="personalizado">Personalizado</option>
            </select>
          </div>
          <label className="flex items-center gap-2 text-gray-600">
            <span>De</span>
            <input
              type="date"
              value={from}
              onChange={(e) => handleRangeChange(e.target.value, to)}
              className="px-3 py-2 border border-gray-200 rounded-lg bg-white text-gray-700"
            />
          </label>
          <label className="flex items-center gap-2 text-gray-600">
            <span>Ate</span>
            <input
              type="date"
              value={to}
              onChange={(e) => handleRangeChange(from, e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg bg-white text-gray-700"
            />
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
          <label className="flex items-center gap-2">
            <span>Tamanho</span>
            <input
              type="range"
              min={6}
              max={20}
              value={markerSize}
              onChange={(e) => setMarkerSize(Number(e.target.value))}
            />
          </label>
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" checked={scaleByValue} onChange={(e) => setScaleByValue(e.target.checked)} />
            Tamanho por valor
          </label>
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" checked={showNames} onChange={(e) => setShowNames(e.target.checked)} />
            Mostrar nomes
          </label>
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" checked={showValues} onChange={(e) => setShowValues(e.target.checked)} />
            Mostrar consumo
          </label>
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" checked={showCounts} onChange={(e) => setShowCounts(e.target.checked)} />
            Mostrar atendimentos
          </label>
        </div>
      </div>

      <div className="bg-white border border-gray-100 rounded-xl p-4">
        <p className="font-semibold text-gray-800 mb-2">Mapa</p>
        <div className="relative h-96 rounded-lg overflow-hidden border">
          <div className="h-full" ref={mapContainerRef} />
          {loading && (
            <div className="absolute inset-0 bg-white/70 flex items-center justify-center text-gray-500">
              <Loader2 className="animate-spin mr-2" size={20} /> Geocodificando...
            </div>
          )}
          {error && !loading && (
            <div className="absolute inset-0 bg-white/80 flex items-center justify-center text-sm text-red-600">
              {error}
            </div>
          )}
        </div>
      </div>

      <div className="bg-white border border-gray-100 rounded-xl p-4">
        <p className="font-semibold text-gray-800 mb-3">Clientes georreferenciados</p>
        <div className="space-y-2">
          {points.map((p, idx) => (
            <div key={idx} className="flex items-center justify-between text-sm text-gray-700">
              <div className="flex items-center gap-2">
                <MapPin size={16} className="text-brand-600" />
                <span>{p.name} • CEP {p.cep}</span>
              </div>
              <div className="text-xs text-gray-500">
                {formatCurrency(p.total)} • {p.atendimentos} atend.
              </div>
            </div>
          ))}
          {points.length === 0 && !loading && !error && (
            <p className="text-gray-400 text-sm">Nenhum CEP valido encontrado no periodo.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default CommercialGeo;
