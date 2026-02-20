import React, { useEffect, useMemo, useRef, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import type { DatesSetArg, EventClickArg } from '@fullcalendar/core';
import { Calendar, Clock, Plus } from 'lucide-react';
import { useAuth } from '../src/auth/AuthProvider';
import { ToastStack } from '../components/Toast';
import { useToast } from '../hooks/useToast';
import EventDrawer from '../components/scheduling/EventDrawer';
import RescheduleModal from '../components/scheduling/RescheduleModal';
import { supabase } from '../lib/supabase';
import {
  confirmEventAttendance,
  listEventsForClinic,
  requestReschedule,
  type ScheduleEventForClinic,
} from '../src/lib/scheduling';

const toLocalLabel = (value: string) =>
  new Date(value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short', hour12: false });

const formatDateTime = (value?: string | null) =>
  value ? new Date(value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short', hour12: false }) : '—';

const formatMonthYear = (value: Date) => {
  const label = value.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  return label.charAt(0).toUpperCase() + label.slice(1);
};

const ClinicAgenda: React.FC = () => {
  const normalizeStatus = (value?: string | null) => (value || '').toLowerCase();
  const resolveStatusBadge = (value?: string | null) => {
    const normalized = normalizeStatus(value);
    if (normalized.includes('confirmado') || normalized === 'confirmed') {
      return { label: 'CONFIRMADO', className: 'bg-emerald-500 text-white' };
    }
    if (normalized.includes('confirmar') || normalized === 'pending' || normalized === 'pending_confirmation') {
      return { label: 'A CONFIRMAR', className: 'bg-rose-500 text-white' };
    }
    return { label: value || '-', className: 'bg-gray-100 text-gray-600' };
  };
  const { effectiveClinicId: clinicId, clinic } = useAuth();
  const calendarRef = useRef<FullCalendar | null>(null);
  const { toasts, push, dismiss } = useToast();
  const [view, setView] = useState<'timeGridDay' | 'timeGridWeek' | 'dayGridMonth'>('dayGridMonth');
  const [range, setRange] = useState<{ start: Date; end: Date } | null>(null);
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<ScheduleEventForClinic[]>([]);
  const [calendarLabel, setCalendarLabel] = useState('');

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<ScheduleEventForClinic | null>(null);

  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [rescheduleForm, setRescheduleForm] = useState({
    reason: '',
    suggestedStart: '',
    suggestedEnd: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [helperModalOpen, setHelperModalOpen] = useState(false);
  const [helperForm, setHelperForm] = useState({
    start: '',
    end: '',
    reason: '',
  });
  const [helperSubmitting, setHelperSubmitting] = useState(false);
  const [helperQuota, setHelperQuota] = useState(0);
  const [helperUsed, setHelperUsed] = useState(0);
  const [helperLoading, setHelperLoading] = useState(false);
  const [helperSummaryOpen, setHelperSummaryOpen] = useState(false);
  const [helperRequests, setHelperRequests] = useState<any[]>([]);
  const [helperRequestsLoading, setHelperRequestsLoading] = useState(false);

  const fetchEvents = async (start?: Date, end?: Date) => {
    if (!clinicId) return;
    setLoading(true);
    try {
      const data = await listEventsForClinic({ clinicId, rangeStart: start, rangeEnd: end });
      setEvents(data);
    } catch (err: any) {
      push({ title: 'Erro ao carregar agenda', description: err?.message, variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const refreshHelperQuota = async () => {
    if (!clinicId) return;
    setHelperLoading(true);
    try {
      const { data: clinicRow } = await supabase
        .from('clinics')
        .select('helper_agenda_quota')
        .eq('id', clinicId)
        .maybeSingle();
      const quota = Number(clinicRow?.helper_agenda_quota ?? clinic?.helper_agenda_quota ?? 0);
      setHelperQuota(Number.isNaN(quota) ? 0 : quota);
      const { count } = await supabase
        .from('clinic_helper_agenda_requests')
        .select('id', { count: 'exact', head: true })
        .eq('clinic_id', clinicId)
        .in('status', ['pending', 'confirmed']);
      setHelperUsed(count || 0);
    } catch (err: any) {
      console.error(err);
    } finally {
      setHelperLoading(false);
    }
  };

  const loadHelperRequests = async () => {
    if (!clinicId) return;
    setHelperRequestsLoading(true);
    try {
      const { data, error } = await supabase
        .from('clinic_helper_agenda_requests')
        .select('id, preferred_start_at, preferred_end_at, reason, status, created_at, handled_at')
        .eq('clinic_id', clinicId)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      setHelperRequests(data || []);
    } catch (err: any) {
      push({ title: 'Não foi possível carregar as solicitações.', description: err?.message, variant: 'error' });
    } finally {
      setHelperRequestsLoading(false);
    }
  };

  useEffect(() => {
    if (!range) return;
    fetchEvents(range.start, range.end);
  }, [range?.start?.toISOString(), range?.end?.toISOString()]);

  useEffect(() => {
    if (!clinicId) return;
    refreshHelperQuota();
  }, [clinicId, clinic?.helper_agenda_quota]);

  const calendarEvents = useMemo(() => {
    return events.map((event) => {
      const tone =
        event.status === 'cancelled'
          ? '#e5e7eb'
          : event.confirm_status === 'confirmed'
            ? '#d1fae5'
            : event.status === 'reschedule_requested'
              ? '#fef3c7'
              : '#dbeafe';
      return {
        id: event.id,
        title: event.title,
        start: event.start_at,
        end: event.end_at,
        backgroundColor: tone,
        borderColor: tone,
        textColor: '#111827',
      };
    });
  }, [events]);

  const upcoming = useMemo(() => {
    const now = new Date();
    return events
      .filter((event) => new Date(event.start_at) >= now && event.status !== 'cancelled')
      .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime())
      .slice(0, 6);
  }, [events]);

  const handleEventClick = (arg: EventClickArg) => {
    const event = events.find((item) => item.id === arg.event.id);
    if (!event) return;
    setSelectedEvent(event);
    setDrawerOpen(true);
  };

  const handleConfirm = async () => {
    if (!selectedEvent || !clinicId) return;
    try {
      await confirmEventAttendance(selectedEvent.id, clinicId);
      push({ title: 'Agendamento confirmado.', variant: 'success' });
      setDrawerOpen(false);
      if (range) await fetchEvents(range.start, range.end);
    } catch (err: any) {
      push({ title: 'Não foi possível confirmar.', description: err?.message, variant: 'error' });
    }
  };

  const handleRequestReschedule = async () => {
    if (!selectedEvent || !clinicId) return;
    if (!rescheduleForm.reason.trim()) {
      push({ title: 'Informe o motivo do reagendamento.', variant: 'info' });
      return;
    }
    setSubmitting(true);
    try {
      await requestReschedule({
        eventId: selectedEvent.id,
        clinicId,
        reason: rescheduleForm.reason.trim(),
        suggestedStartAt: rescheduleForm.suggestedStart
          ? new Date(rescheduleForm.suggestedStart).toISOString()
          : null,
        suggestedEndAt: rescheduleForm.suggestedEnd
          ? new Date(rescheduleForm.suggestedEnd).toISOString()
          : null,
      });
      push({ title: 'Solicitação enviada.', variant: 'success' });
      setRescheduleOpen(false);
      setDrawerOpen(false);
      setRescheduleForm({ reason: '', suggestedStart: '', suggestedEnd: '' });
      if (range) await fetchEvents(range.start, range.end);
    } catch (err: any) {
      push({ title: 'Não foi possível solicitar reagendamento.', description: err?.message, variant: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleRequestHelperAgenda = async () => {
    if (!clinicId) return;
    if (!helperForm.start) {
      push({ title: 'Informe a data e hora desejadas.', variant: 'info' });
      return;
    }
    if (!helperForm.reason.trim()) {
      push({ title: 'Descreva o motivo da agenda extraordinária.', variant: 'info' });
      return;
    }
    const remaining = Math.max(0, helperQuota - helperUsed);
    if (remaining <= 0) {
      push({ title: 'Limite de agendas DRN atingido.', variant: 'error' });
      return;
    }
    setHelperSubmitting(true);
    try {
      const startIso = new Date(helperForm.start).toISOString();
      const endIso = helperForm.end ? new Date(helperForm.end).toISOString() : null;
      const { error } = await supabase.rpc('request_helper_agenda', {
        p_clinic_id: clinicId,
        p_start_at: startIso,
        p_end_at: endIso,
        p_reason: helperForm.reason.trim(),
      });
      if (error) throw error;
      push({ title: 'Solicitação enviada para os DRN.', variant: 'success' });
      setHelperModalOpen(false);
      setHelperForm({ start: '', end: '', reason: '' });
      await refreshHelperQuota();
    } catch (err: any) {
      push({ title: 'Não foi possível solicitar.', description: err?.message, variant: 'error' });
    } finally {
      setHelperSubmitting(false);
    }
  };

  const handleDatesSet = (info: DatesSetArg) => {
    setRange({ start: info.start, end: info.end });
    setCalendarLabel(formatMonthYear(info.view.currentStart));
  };

  const switchView = (next: typeof view) => {
    setView(next);
    calendarRef.current?.getApi().changeView(next);
  };

  if (!clinicId) {
    return <div className="text-sm text-gray-500">Selecione uma clínica para visualizar a agenda.</div>;
  }

  const helperRemaining = Math.max(0, helperQuota - helperUsed);

  return (
    <div className="space-y-6">
      <ToastStack items={toasts} onDismiss={dismiss} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Agendamento Inteligente</h1>
          <p className="text-sm text-gray-500">{clinic?.name ? `Clínica ${clinic.name}` : 'Agenda da clínica'}</p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <button
            type="button"
            onClick={() => {
              setHelperSummaryOpen(true);
              loadHelperRequests();
            }}
            className="px-3 py-2 text-xs rounded-lg border border-gray-200 bg-white text-gray-600 hover:border-gray-300"
          >
            {helperLoading ? 'DRN: carregando...' : `DRN: ${helperRemaining} de ${helperQuota}`}
          </button>
          <button
            type="button"
            onClick={() => setHelperModalOpen(true)}
            disabled={helperRemaining <= 0 || helperLoading}
            className="px-3 py-2 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50 flex items-center gap-2"
          >
            <Plus size={16} /> Solicitar agenda DRN
          </button>
          <button
            type="button"
            onClick={() => calendarRef.current?.getApi().today()}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg"
          >
            Hoje
          </button>
          <button
            type="button"
            onClick={() => calendarRef.current?.getApi().prev()}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg"
          >
            ◀
          </button>
          <button
            type="button"
            onClick={() => calendarRef.current?.getApi().next()}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg"
          >
            ▶
          </button>
          <button
            type="button"
            onClick={() => switchView('timeGridDay')}
            className={`px-3 py-2 text-sm border rounded-lg ${view === 'timeGridDay' ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-gray-700 border-gray-200'}`}
          >
            Dia
          </button>
          <button
            type="button"
            onClick={() => switchView('timeGridWeek')}
            className={`px-3 py-2 text-sm border rounded-lg ${view === 'timeGridWeek' ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-gray-700 border-gray-200'}`}
          >
            Semana
          </button>
          <button
            type="button"
            onClick={() => switchView('dayGridMonth')}
            className={`px-3 py-2 text-sm border rounded-lg ${view === 'dayGridMonth' ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-gray-700 border-gray-200'}`}
          >
            Mês
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px] gap-4">
        <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <Calendar size={16} /> {loading ? 'Carregando agenda...' : 'Agenda da clínica'}
          </div>
          <div className="mb-3 text-lg font-semibold text-gray-800">{calendarLabel || '—'}</div>
          <FullCalendar
            ref={calendarRef}
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            initialView={view}
            height="auto"
            selectable={false}
            editable={false}
            events={calendarEvents}
            eventClick={handleEventClick}
            datesSet={handleDatesSet}
            headerToolbar={false}
            dayMaxEventRows
            nowIndicator
          />
        </div>

        <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3">
            <Clock size={16} /> Próximos agendamentos
          </div>
          {upcoming.length === 0 && (
            <p className="text-sm text-gray-500">Nenhum agendamento futuro encontrado.</p>
          )}
          <div className="space-y-3">
            {upcoming.map((event) => (
              <button
                key={event.id}
                type="button"
                onClick={() => {
                  setSelectedEvent(event);
                  setDrawerOpen(true);
                }}
                className="w-full text-left border border-gray-100 rounded-xl px-3 py-3 hover:border-brand-200 hover:bg-brand-50 transition"
              >
                <div className="text-sm font-semibold text-gray-800">{event.title}</div>
                <div className="text-xs text-gray-500">{toLocalLabel(event.start_at)} • {toLocalLabel(event.end_at)}</div>
                <div className="mt-1 flex items-center gap-2 text-xs text-gray-500">
                  <span>Status:</span>
                  <span className={`px-2 py-1 rounded-full text-[10px] font-semibold ${resolveStatusBadge(event.confirm_status).className}`}>
                    {resolveStatusBadge(event.confirm_status).label}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      <EventDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        event={selectedEvent}
        clinicView
        onConfirm={handleConfirm}
        onRequestReschedule={() => setRescheduleOpen(true)}
      />

      <RescheduleModal
        open={rescheduleOpen}
        reason={rescheduleForm.reason}
        suggestedStart={rescheduleForm.suggestedStart}
        suggestedEnd={rescheduleForm.suggestedEnd}
        submitting={submitting}
        onChange={(patch) => setRescheduleForm((prev) => ({ ...prev, ...patch }))}
        onSubmit={handleRequestReschedule}
        onClose={() => setRescheduleOpen(false)}
      />

      {helperModalOpen && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
          onClick={() => setHelperModalOpen(false)}
        >
          <div
            className="bg-white rounded-xl shadow-xl p-4 sm:p-6 w-full max-w-xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h4 className="text-lg font-semibold text-gray-800">Solicitar agenda de DRN</h4>
              <button
                type="button"
                onClick={() => setHelperModalOpen(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <div className="space-y-3">
              <div className="text-sm text-gray-500">
                Informe a data e horário desejados. Nossa equipe confirmará a disponibilidade.
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Início desejado</label>
                  <input
                    type="datetime-local"
                    value={helperForm.start}
                    onChange={(e) => setHelperForm((prev) => ({ ...prev, start: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-brand-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fim sugerido (opcional)</label>
                  <input
                    type="datetime-local"
                    value={helperForm.end}
                    onChange={(e) => setHelperForm((prev) => ({ ...prev, end: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-brand-500 outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Motivo / detalhes</label>
                <textarea
                  value={helperForm.reason}
                  onChange={(e) => setHelperForm((prev) => ({ ...prev, reason: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-brand-500 outline-none"
                  placeholder="Descreva o motivo da agenda extraordinária."
                />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="text-xs text-gray-500">
                Saldo disponível: {helperRemaining} de {helperQuota}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setHelperModalOpen(false)}
                  className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleRequestHelperAgenda}
                  disabled={helperSubmitting || helperRemaining <= 0}
                  className="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50"
                >
                  {helperSubmitting ? 'Enviando...' : 'Enviar solicitação'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {helperSummaryOpen && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
          onClick={() => setHelperSummaryOpen(false)}
        >
          <div
            className="bg-white rounded-xl shadow-xl p-4 sm:p-6 w-full max-w-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-lg font-semibold text-gray-800">Solicitação Agenda DRN</h4>
                <p className="text-sm text-gray-500">Resumo das solicitações enviadas pela clínica.</p>
              </div>
              <button
                type="button"
                onClick={() => setHelperSummaryOpen(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            {helperRequestsLoading && (
              <p className="text-sm text-gray-500">Carregando solicitações...</p>
            )}
            {!helperRequestsLoading && helperRequests.length === 0 && (
              <p className="text-sm text-gray-500">Nenhuma solicitação encontrada.</p>
            )}
            {!helperRequestsLoading && helperRequests.length > 0 && (
              <div className="space-y-3">
                {helperRequests.map((req) => {
                  const statusBadge = resolveStatusBadge(req.status);
                  return (
                    <div key={req.id} className="border border-gray-100 rounded-xl p-3 text-sm text-gray-600">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-xs text-gray-400">
                        {formatDateTime(req.created_at)}
                      </div>
                      <span className={`px-2 py-1 text-[10px] rounded-full uppercase font-semibold ${statusBadge.className}`}>
                        {statusBadge.label}
                      </span>
                    </div>
                    <div className="mt-2 text-sm text-gray-800">
                      {formatDateTime(req.preferred_start_at)} → {formatDateTime(req.preferred_end_at)}
                    </div>
                    <div className="mt-1 text-xs text-gray-500">{req.reason}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ClinicAgenda;
