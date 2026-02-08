import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, MapPin, Calendar } from 'lucide-react';
import { useAuth } from '../src/auth/AuthProvider';
import { fetchCommercialGeoData, updateCustomersGeo, type CommercialGeoDataset } from '../lib/commercial';
import { formatCurrency } from '../lib/utils';
import { useModalControls } from '../hooks/useModalControls';

type Period = 'quinzenal' | 'mensal' | 'trimestral' | 'semestral' | 'anual' | 'personalizado';

type GeoPoint = {
  name: string;
  cep: string;
  lat: number;
  lng: number;
  total: number;
  atendimentos: number;
};

type GeoTarget = {
  customerId: string;
  name: string;
  cep: string;
  total: number;
  atendimentos: number;
  lat?: number | null;
  lng?: number | null;
};

type LeafletModule = any;

const GEO_CACHE_KEY = 'onefincGeoCache';
const GEO_TIMEOUT_MS = 4500;
const GEO_BATCH_SIZE = 25;
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
const toNumberOrNull = (value: unknown) => {
  if (value === null || value === undefined) return null;
  const num = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(num) ? num : null;
};

const geocodeCep = async (
  cep: string,
  cacheRef: React.MutableRefObject<Record<string, { lat: number; lng: number }>>,
  timeoutMs = GEO_TIMEOUT_MS
) => {
  const cleaned = cleanCep(cep);
  if (cleaned.length < 5) return null;
  if (cacheRef.current[cleaned]) return cacheRef.current[cleaned];
  const url = `https://nominatim.openstreetmap.org/search?postalcode=${encodeURIComponent(cleaned)}&country=Brazil&format=json&limit=1`;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, { headers: { 'Accept-Language': 'pt-BR' }, signal: controller.signal });
    clearTimeout(timer);
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
  const { effectiveClinicId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [points, setPoints] = useState<GeoPoint[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [dataset, setDataset] = useState<CommercialGeoDataset | null>(null);
  const [attendanceFilter, setAttendanceFilter] = useState<'all' | 'attended' | 'not_attended'>('all');
  const [period, setPeriod] = useState<Period>('mensal');
  const initialRange = rangeFromPeriod('mensal');
  const [{ from, to }, setRange] = useState(() => initialRange);
  const [draftFrom, setDraftFrom] = useState(() => initialRange.from);
  const [draftTo, setDraftTo] = useState(() => initialRange.to);
  const [markerSize, setMarkerSize] = useState(10);
  const [scaleByValue, setScaleByValue] = useState(true);
  const [showNames, setShowNames] = useState(true);
  const [showValues, setShowValues] = useState(true);
  const [showCounts, setShowCounts] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [pendingCeps, setPendingCeps] = useState<string[]>([]);
  const [geocodeTotal, setGeocodeTotal] = useState(0);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [isMapExpanded, setIsMapExpanded] = useState(false);

  const mapRef = useRef<any>(null);
  const markersRef = useRef<any>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const cacheRef = useRef<Record<string, { lat: number; lng: number }>>({});
  const targetsRef = useRef<GeoTarget[]>([]);
  const missingByCepRef = useRef<Record<string, string[]>>({});
  const loadIdRef = useRef(0);
  const geoRunIdRef = useRef(0);

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
    const nextRange = rangeFromPeriod(next);
    setDraftFrom(nextRange.from);
    setDraftTo(nextRange.to);
  };

  const handleRangeChange = (nextFrom: string, nextTo: string) => {
    setPeriod('personalizado');
    setDraftFrom(nextFrom);
    setDraftTo(nextTo);
  };

  const applyDateFilter = () => {
    setRange({ from: draftFrom, to: draftTo });
  };

  const clearDateFilter = () => {
    setPeriod('personalizado');
    setDraftFrom('');
    setDraftTo('');
    setRange({ from: '', to: '' });
  };

  const rebuildPoints = () => {
    const nextPoints = targetsRef.current
      .map((t) => {
        const directLat = toNumberOrNull(t.lat);
        const directLng = toNumberOrNull(t.lng);
        if (directLat !== null && directLng !== null) {
          return {
            name: t.name,
            cep: t.cep,
            lat: directLat,
            lng: directLng,
            total: t.total,
            atendimentos: t.atendimentos,
          };
        }
        const geo = cacheRef.current[cleanCep(t.cep)];
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
  };

  const startGeocodeBatch = async (
    batchSize = GEO_BATCH_SIZE,
    runId = geoRunIdRef.current,
    source?: string[]
  ) => {
    if (isGeocoding) return;
    const sourceList = source ?? pendingCeps;
    const batch = sourceList.slice(0, batchSize);
    if (!batch.length) return;
    setIsGeocoding(true);
    await Promise.all(
      batch.map(async (cep) => {
        const geo = await geocodeCep(cep, cacheRef);
        if (!geo) return;
        if (geoRunIdRef.current !== runId) return;
        const ids = missingByCepRef.current[cep];
        if (ids && ids.length) {
          await updateCustomersGeo(ids, geo);
          delete missingByCepRef.current[cep];
        }
      })
    );
    if (geoRunIdRef.current !== runId) {
      setIsGeocoding(false);
      return;
    }
    const batchSet = new Set(batch);
    setPendingCeps((prev) => prev.filter((cep) => !batchSet.has(cep)));
    rebuildPoints();
    setIsGeocoding(false);
  };

  useEffect(() => {
    const load = async () => {
      const loadId = ++loadIdRef.current;
      if (!effectiveClinicId) {
        setPoints([]);
        setDataset(null);
        setLoading(false);
        setError('Selecione uma clinica para visualizar o mapa.');
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const data = await fetchCommercialGeoData({
          clinicId: effectiveClinicId,
          from: from || undefined,
          to: to || undefined,
        });
        if (loadIdRef.current !== loadId) return;
        setDataset(data);
      } catch (err: any) {
        setError(err.message || 'Erro ao carregar dados do mapa.');
      } finally {
        if (loadIdRef.current === loadId) {
          setLoading(false);
        }
      }
    };
    load();
  }, [effectiveClinicId, from, to]);

  useEffect(() => {
    if (!dataset) return;
    const runId = ++geoRunIdRef.current;
    targetsRef.current = [];
    missingByCepRef.current = {};
    setPendingCeps([]);
    setGeocodeTotal(0);
    setIsGeocoding(false);

    const normalizeName = (name: string) => name.trim().toLowerCase();
    const totalsByName = new Map<string, { total: number; atendimentos: number }>();
    dataset.revenues.forEach((rev) => {
      const name = (rev.paciente || 'Sem nome').trim() || 'Sem nome';
      const key = normalizeName(name);
      const current = totalsByName.get(key) || { total: 0, atendimentos: 0 };
      const value = Number(rev.valor_liquido ?? rev.valor ?? 0);
      totalsByName.set(key, {
        total: current.total + (isFinite(value) ? value : 0),
        atendimentos: current.atendimentos + 1,
      });
    });

    const nextTargets = dataset.customers
      .filter((customer) => customer.name && customer.cep)
      .map((customer) => {
        const key = normalizeName(customer.name || '');
        const stats = totalsByName.get(key) || { total: 0, atendimentos: 0 };
        const lat = toNumberOrNull(customer.lat);
        const lng = toNumberOrNull(customer.lng);
        const attended = stats.atendimentos > 0;
        if (attendanceFilter === 'attended' && !attended) return null;
        if (attendanceFilter === 'not_attended' && attended) return null;
        return {
          customerId: customer.id,
          name: customer.name || 'Sem nome',
          cep: customer.cep || '',
          total: stats.total,
          atendimentos: stats.atendimentos,
          lat,
          lng,
        };
      })
      .filter(Boolean) as GeoTarget[];

    if (!nextTargets.length) {
      setPoints([]);
      return;
    }

    targetsRef.current = nextTargets;

    const uniqueCeps = new Set<string>();
    nextTargets.forEach((target) => {
      const cep = cleanCep(target.cep);
      if (!cep) return;
      uniqueCeps.add(cep);
      const latValue = toNumberOrNull(target.lat);
      const lngValue = toNumberOrNull(target.lng);
      if (latValue !== null && lngValue !== null) {
        cacheRef.current[cep] = { lat: latValue, lng: lngValue };
        return;
      }
      if (latValue === null || lngValue === null) {
        if (!missingByCepRef.current[cep]) missingByCepRef.current[cep] = [];
        missingByCepRef.current[cep].push(target.customerId);
      }
    });

    Object.entries(missingByCepRef.current).forEach(([cep, ids]) => {
      const geo = cacheRef.current[cep];
      if (!geo || !ids.length) return;
      void updateCustomersGeo(ids, geo);
      delete missingByCepRef.current[cep];
    });

    const uniqueList = Array.from(uniqueCeps);
    const pending = uniqueList.filter((cep) => !cacheRef.current[cep]);
    setPendingCeps(pending);
    setGeocodeTotal(uniqueList.length);

    rebuildPoints();

    if (pending.length) {
      startGeocodeBatch(GEO_BATCH_SIZE, runId, pending);
    }
  }, [dataset, attendanceFilter]);

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

  useEffect(() => {
    if (!mapRef.current) return;
    const timer = setTimeout(() => {
      if (mapRef.current) mapRef.current.invalidateSize();
    }, 150);
    return () => clearTimeout(timer);
  }, [isMapExpanded]);

  const mapModalControls = useModalControls({
    isOpen: isMapExpanded,
    onClose: () => setIsMapExpanded(false),
  });

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

  const renderFilters = (variant: 'page' | 'modal') => (
    <div className={variant === 'modal' ? 'bg-white border border-gray-100 rounded-xl shadow-sm p-4 space-y-3' : 'space-y-3'}>
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
            value={draftFrom}
            onChange={(e) => handleRangeChange(e.target.value, draftTo)}
            className="px-3 py-2 border border-gray-200 rounded-lg bg-white text-gray-700"
          />
        </label>
        <label className="flex items-center gap-2 text-gray-600">
          <span>Ate</span>
          <input
            type="date"
            value={draftTo}
            onChange={(e) => handleRangeChange(draftFrom, e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg bg-white text-gray-700"
          />
        </label>
        <label className="flex items-center gap-2 text-gray-600">
          <span>Atendimento</span>
          <select
            value={attendanceFilter}
            onChange={(e) => setAttendanceFilter(e.target.value as 'all' | 'attended' | 'not_attended')}
            className="px-3 py-2 border border-gray-200 rounded-lg bg-white text-gray-700"
          >
            <option value="all">Todos</option>
            <option value="attended">Com atendimento</option>
            <option value="not_attended">Sem atendimento</option>
          </select>
        </label>
        <button
          type="button"
          onClick={applyDateFilter}
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50"
        >
          Aplicar
        </button>
        {(from || to || draftFrom || draftTo) && (
          <button
            type="button"
            onClick={clearDateFilter}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50"
          >
            Limpar
          </button>
        )}
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
  );

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-800">Comercial • Geolocalizacao</h1>
      <p className="text-gray-500">Clientes destacados por CEP, com consumo e recorrencia no periodo.</p>

      {!isMapExpanded && (
        <div className="bg-white border border-gray-100 rounded-xl shadow-sm p-4">
          {renderFilters('page')}
        </div>
      )}

      <div
        className={isMapExpanded ? 'fixed inset-0 z-50 bg-black/40 p-4 sm:p-6' : ''}
        onClick={isMapExpanded ? mapModalControls.onBackdropClick : undefined}
      >
        <div
          className={isMapExpanded ? 'bg-white rounded-2xl shadow-xl p-4 sm:p-6 h-full flex flex-col' : 'bg-white border border-gray-100 rounded-xl p-4'}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <p className="font-semibold text-gray-800">Mapa</p>
            <div className="flex items-center gap-2">
              {geocodeTotal > 0 && (
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span>Geocodificados {geocodeTotal - pendingCeps.length} de {geocodeTotal}</span>
                  {pendingCeps.length > 0 && !isGeocoding && (
                    <button
                      type="button"
                      onClick={() => startGeocodeBatch()}
                      className="px-2 py-1 border border-gray-200 rounded-md text-gray-600 hover:bg-gray-50"
                    >
                      Continuar
                    </button>
                  )}
                  {isGeocoding && <span>Geocodificando...</span>}
                </div>
              )}
              <button
                type="button"
                onClick={() => setIsMapExpanded((prev) => !prev)}
                className="px-3 py-2 text-sm border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                {isMapExpanded ? 'Fechar' : 'Abrir em tela cheia'}
              </button>
            </div>
          </div>
          {isMapExpanded && (
            <div className="mb-3">
              {renderFilters('modal')}
            </div>
          )}
          <div className={isMapExpanded ? 'relative flex-1 min-h-[360px] rounded-lg overflow-hidden border' : 'relative h-96 rounded-lg overflow-hidden border'}>
            <div className="h-full" ref={mapContainerRef} />
            {loading && (
              <div className="absolute inset-0 bg-white/70 flex items-center justify-center text-gray-500">
                <Loader2 className="animate-spin mr-2" size={20} /> Carregando...
              </div>
            )}
            {error && !loading && (
              <div className="absolute inset-0 bg-white/80 flex items-center justify-center text-sm text-red-600">
                {error}
              </div>
            )}
          </div>
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
