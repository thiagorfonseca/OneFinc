import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import type { DateSelectArg, DatesSetArg, EventClickArg, EventDropArg } from '@fullcalendar/core';
import type { EventResizeDoneArg } from '@fullcalendar/interaction';
import { Calendar, Plus } from 'lucide-react';
import { useAuth } from '../src/auth/AuthProvider';
import EventModal, { EventFormState } from '../components/scheduling/EventModal';
import EventDrawer from '../components/scheduling/EventDrawer';
import { ToastStack } from '../components/Toast';
import { useToast } from '../hooks/useToast';
import { useModalControls } from '../hooks/useModalControls';
import {
  buildRecurrenceRule,
  cancelEvent,
  deleteEvent,
  createEvent,
  expandRecurringOccurrences,
  listChangeRequests,
  listEventsForAdmin,
  resolveRecurrenceOption,
  suggestTimeSlots,
  updateEvent,
  type ScheduleAdminEvent,
  type SuggestedSlot,
} from '../src/lib/scheduling';
import { supabase } from '../lib/supabase';

const emptyForm: EventFormState = {
  title: '',
  description: '',
  start: '',
  end: '',
  timezone: 'America/Sao_Paulo',
  location: '',
  meeting_url: '',
  recurrence: 'none',
  consultant_id: '',
  consultant_ids: [],
};

const toLocalInput = (value: string | Date) => {
  const date = value instanceof Date ? value : new Date(value);
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};

const formatDateTime = (value?: string | null) =>
  value ? new Date(value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short', hour12: false }) : '—';

const formatMonthYear = (value: Date) => {
  const label = value.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  return label.charAt(0).toUpperCase() + label.slice(1);
};

const overlapsRange = (startAt: string, endAt: string, range?: { start: Date; end: Date } | null) => {
  if (!range) return true;
  const start = new Date(startAt);
  const end = new Date(endAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return false;
  return end > range.start && start < range.end;
};

const resolveStatusBadge = (value?: string | null) => {
  const normalized = (value || '').toLowerCase();
  if (normalized === 'confirmed') {
    return { label: 'CONFIRMADO', className: 'bg-emerald-200 text-gray-900' };
  }
  if (normalized === 'pending' || normalized === 'pending_confirmation') {
    return { label: 'A CONFIRMAR', className: 'bg-rose-100 text-rose-800' };
  }
  if (normalized === 'declined') {
    return { label: 'RECUSADO', className: 'bg-gray-200 text-gray-700' };
  }
  if (normalized === 'reschedule_requested') {
    return { label: 'REAGENDAR', className: 'bg-amber-100 text-amber-700' };
  }
  if (normalized === 'rescheduled') {
    return { label: 'REAGENDADO', className: 'bg-sky-100 text-sky-700' };
  }
  if (normalized === 'cancelled') {
    return { label: 'CANCELADO', className: 'bg-gray-200 text-gray-700' };
  }
  return { label: value || '-', className: 'bg-gray-100 text-gray-600' };
};

const resolveEventBadge = (event: ScheduleAdminEvent) => {
  if (event.is_external) {
    return { label: 'EXTERNO', className: 'bg-slate-200 text-slate-700' };
  }
  return resolveStatusBadge(event.status);
};

const AdminAgenda: React.FC = () => {
  const { user, profile, isSystemAdmin, isOneDoctorInternal } = useAuth();
  const calendarRef = useRef<FullCalendar | null>(null);
  const { toasts, push, dismiss } = useToast();
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<ScheduleAdminEvent[]>([]);
  const [clinics, setClinics] = useState<Array<{ id: string; name: string }>>([]);
  const [consultants, setConsultants] = useState<Array<{
    id: string;
    full_name: string | null;
    role?: string | null;
    google_connected?: boolean | null;
    last_google_sync_at?: string | null;
  }>>([]);
  const [selectedConsultantId, setSelectedConsultantId] = useState<string | null>(null);
  const [selectedConsultantIds, setSelectedConsultantIds] = useState<string[]>([]);
  const [view, setView] = useState<'timeGridDay' | 'timeGridWeek' | 'dayGridMonth'>('dayGridMonth');
  const [range, setRange] = useState<{ start: Date; end: Date } | null>(null);
  const [calendarLabel, setCalendarLabel] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [form, setForm] = useState<EventFormState>(emptyForm);
  const [selectedClinics, setSelectedClinics] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [suggestions, setSuggestions] = useState<SuggestedSlot[]>([]);
  const [suggesting, setSuggesting] = useState(false);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<ScheduleAdminEvent | null>(null);
  const [changeRequests, setChangeRequests] = useState<any[]>([]);

  const [rescheduleRequests, setRescheduleRequests] = useState<any[]>([]);
  const [rescheduleModalOpen, setRescheduleModalOpen] = useState(false);
  const [rescheduleLoading, setRescheduleLoading] = useState(false);
  const lastRescheduleCount = useRef(0);
  const [pendingRescheduleRequest, setPendingRescheduleRequest] = useState<any | null>(null);
  const [helperRequests, setHelperRequests] = useState<any[]>([]);
  const [helperModalOpen, setHelperModalOpen] = useState(false);
  const [helperLoading, setHelperLoading] = useState(false);
  const lastHelperCount = useRef(0);
  const [syncingGoogle, setSyncingGoogle] = useState(false);
  const notifiedRef = useRef<Set<string>>(new Set());
  const autoSyncRef = useRef<Map<string, number>>(new Map());
  const AUTO_SYNC_MINUTES = 15;

  const sb = supabase as any;

  const isConsultantOnly = isOneDoctorInternal && !isSystemAdmin;

  const rescheduleModalControls = useModalControls({
    isOpen: rescheduleModalOpen,
    onClose: () => setRescheduleModalOpen(false),
  });

  useEffect(() => {
    if (!isSystemAdmin && !isOneDoctorInternal) return;
    const loadClinics = async () => {
      const { data } = await sb.from('clinics').select('id, name').order('name', { ascending: true });
      setClinics((data || []).map((row: any) => ({ id: row.id, name: row.name })));
    };
    loadClinics();
  }, [isSystemAdmin, isOneDoctorInternal]);

  useEffect(() => {
    if (!isSystemAdmin && !isOneDoctorInternal) return;
    const loadConsultants = async () => {
      if (isConsultantOnly && user?.id) {
        setConsultants([
          {
            id: user.id,
            full_name: profile?.full_name || user.email || 'Você',
            role: profile?.role ?? null,
            google_connected: (profile as any)?.google_connected ?? null,
            last_google_sync_at: (profile as any)?.last_google_sync_at ?? null,
          },
        ]);
        setSelectedConsultantId(user.id);
        return;
      }
      const { data, error } = await sb
        .from('profiles')
        .select('id, full_name, role, google_connected, last_google_sync_at, show_in_team_agenda')
        .in('role', ['system_owner', 'super_admin', 'one_doctor_admin', 'one_doctor_sales'])
        .order('full_name', { ascending: true });
      let list = (data || []) as Array<{
        id: string;
        full_name: string | null;
        role?: string | null;
        google_connected?: boolean | null;
        last_google_sync_at?: string | null;
        show_in_team_agenda?: boolean | null;
      }>;
      list = list.filter((row) => row.show_in_team_agenda !== false);
      if (user?.id && !list.some((row) => row.id === user.id)) {
        list = [
          {
            id: user.id,
            full_name: profile?.full_name || user.email || 'Você',
            role: profile?.role ?? null,
            google_connected: (profile as any)?.google_connected ?? null,
            last_google_sync_at: (profile as any)?.last_google_sync_at ?? null,
            show_in_team_agenda: true,
          },
          ...list,
        ];
      }
      setConsultants(list);
      if (!selectedConsultantId && list.length > 0) {
        setSelectedConsultantId(list[0].id);
      }
      if (error) {
        push({ title: 'Não foi possível carregar consultores.', description: error.message, variant: 'error' });
      }
    };
    loadConsultants();
  }, [isSystemAdmin, isOneDoctorInternal, isConsultantOnly, user?.id, user?.email, profile?.full_name, profile?.role]);

  useEffect(() => {
    if (user?.id && !selectedConsultantId) {
      setSelectedConsultantId(user.id);
    }
  }, [user?.id, selectedConsultantId]);

  const selectedConsultant = useMemo(
    () => consultants.find((row) => row.id === selectedConsultantId) || null,
    [consultants, selectedConsultantId],
  );
  const lastSyncLabel = useMemo(() => {
    const value = selectedConsultant?.last_google_sync_at;
    if (!value) return 'Última sincronização: —';
    return `Última sincronização: ${formatDateTime(value)}`;
  }, [selectedConsultant?.last_google_sync_at]);

  const fetchEvents = async (end?: Date) => {
    if (!selectedConsultantId) return;
    setLoading(true);
    try {
      const data = await listEventsForAdmin({
        consultantId: selectedConsultantId,
        rangeStart: undefined,
        rangeEnd: end,
      });
      setEvents(data);
    } catch (err: any) {
      push({ title: 'Erro ao carregar agenda', description: err?.message, variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!range) return;
    fetchEvents(range.end);
  }, [range?.start?.toISOString(), range?.end?.toISOString(), selectedConsultantId]);

  useEffect(() => {
    if (!isConsultantOnly || !user?.id || !selectedConsultantId || user.id !== selectedConsultantId) return;
    const checkAlerts = () => {
      const now = Date.now();
      events.forEach((event) => {
        if (event.status === 'cancelled') return;
        if (event.consultant_confirm_status === 'declined') return;
        const start = new Date(event.start_at).getTime();
        const diffMinutes = Math.round((start - now) / 60000);
        [60, 30].forEach((threshold) => {
          if (diffMinutes <= threshold && diffMinutes >= threshold - 1) {
            const key = `${event.id}-${threshold}`;
            if (notifiedRef.current.has(key)) return;
            notifiedRef.current.add(key);
            push({
              title: `Agendamento em ${threshold} minutos`,
              description: `${event.title} • ${formatDateTime(event.start_at)}`,
              variant: 'info',
            });
          }
        });
      });
    };
    checkAlerts();
    const interval = window.setInterval(checkAlerts, 30000);
    return () => window.clearInterval(interval);
  }, [events, isConsultantOnly, selectedConsultantId, user?.id]);

  const loadRescheduleRequests = useCallback(async () => {
    if (!isSystemAdmin) return;
    setRescheduleLoading(true);
    const { data, error } = await sb
      .from('schedule_change_requests')
      .select('id, event_id, reason, suggested_start_at, suggested_end_at, status, created_at, clinic_id, schedule_events (id, title, start_at, end_at, location, meeting_url, description, timezone), clinics (id, name)')
      .eq('status', 'open')
      .order('created_at', { ascending: false });
    if (!error) {
      const next = data || [];
      setRescheduleRequests(next);
      if (next.length > 0 && next.length !== lastRescheduleCount.current) {
        setRescheduleModalOpen(true);
      }
      lastRescheduleCount.current = next.length;
    }
    setRescheduleLoading(false);
  }, [isSystemAdmin]);

  const loadHelperRequests = useCallback(async () => {
    if (!isSystemAdmin) return;
    setHelperLoading(true);
    const { data, error } = await sb
      .from('clinic_helper_agenda_requests')
      .select('id, clinic_id, preferred_start_at, preferred_end_at, reason, status, created_at, clinics (id, name)')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    if (!error) {
      const next = data || [];
      setHelperRequests(next);
      if (next.length > 0 && next.length !== lastHelperCount.current) {
        setHelperModalOpen(true);
      }
      lastHelperCount.current = next.length;
    }
    setHelperLoading(false);
  }, [isSystemAdmin]);

  useEffect(() => {
    if (!isSystemAdmin) return;
    let active = true;
    const run = async () => {
      if (!active) return;
      await loadRescheduleRequests();
      await loadHelperRequests();
    };
    run();
    const interval = window.setInterval(run, 60000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [isSystemAdmin, loadRescheduleRequests, loadHelperRequests]);

  const calendarEvents = useMemo(() => {
    const calendarRange = range;
    return events.flatMap((event) => {
      const isExternal = Boolean(event.is_external);
      const backgroundColor = isExternal
        ? '#e2e8f0'
        : event.status === 'cancelled'
          ? '#e5e7eb'
          : event.status === 'reschedule_requested'
            ? '#fef3c7'
            : event.status === 'confirmed'
              ? '#d1fae5'
              : '#dbeafe';
      const borderColor = isExternal ? '#94a3b8' : event.status === 'cancelled' ? '#e5e7eb' : '#93c5fd';
      const baseProps = {
        title: event.title,
        backgroundColor,
        borderColor,
        textColor: '#111827',
      };

      if (!event.recurrence_rule || isExternal) {
        if (!overlapsRange(event.start_at, event.end_at, calendarRange)) return [];
        return [{
          id: event.id,
          ...baseProps,
          start: event.start_at,
          end: event.end_at,
          editable: !isExternal,
          extendedProps: { isExternal },
        }];
      }

      if (!calendarRange) {
        return [{
          id: event.id,
          ...baseProps,
          start: event.start_at,
          end: event.end_at,
          editable: false,
          extendedProps: { isExternal: false, recurringInstance: true, baseEventId: event.id },
        }];
      }

      const occurrences = expandRecurringOccurrences({
        recurrenceRule: event.recurrence_rule,
        startAt: event.start_at,
        endAt: event.end_at,
        rangeStart: calendarRange.start,
        rangeEnd: calendarRange.end,
      });

      return occurrences.map((occ) => ({
        id: `${event.id}::${occ.key}`,
        ...baseProps,
        start: occ.start_at,
        end: occ.end_at,
        editable: false,
        extendedProps: { isExternal: false, recurringInstance: true, baseEventId: event.id },
      }));
    });
  }, [events, range]);

  const upcoming = useMemo(() => {
    const now = new Date();
    return events
      .filter((event) => new Date(event.start_at) >= now && event.status !== 'cancelled')
      .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime())
      .slice(0, 6);
  }, [events]);

  const openCreate = (start?: Date, end?: Date) => {
    const consultantId = isConsultantOnly ? user?.id || '' : selectedConsultantId || '';
    setModalMode('create');
    setForm({
      ...emptyForm,
      start: start ? toLocalInput(start) : '',
      end: end ? toLocalInput(end) : '',
      consultant_id: consultantId,
      consultant_ids: consultantId ? [consultantId] : [],
    });
    setSelectedClinics([]);
    setSelectedConsultantIds(consultantId ? [consultantId] : []);
    setSuggestions([]);
    setPendingRescheduleRequest(null);
    setModalOpen(true);
  };

  const openEdit = (event: ScheduleAdminEvent) => {
    if (event.is_external) return;
    setModalMode('edit');
    setForm({
      title: event.title,
      description: event.description || '',
      start: toLocalInput(event.start_at),
      end: toLocalInput(event.end_at),
      timezone: event.timezone || 'America/Sao_Paulo',
      location: event.location || '',
      meeting_url: event.meeting_url || '',
      recurrence: resolveRecurrenceOption(event.recurrence_rule),
      consultant_id: event.consultant_id,
      consultant_ids: [event.consultant_id],
    });
    setSelectedClinics(event.attendees.map((att) => att.clinic_id));
    setSelectedConsultantIds([event.consultant_id]);
    setSuggestions([]);
    setPendingRescheduleRequest(null);
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!user?.id) return;
    const consultantIds = isConsultantOnly
      ? [user.id]
      : modalMode === 'create'
        ? (selectedConsultantIds.length ? selectedConsultantIds : (form.consultant_ids || []))
        : [form.consultant_id || selectedConsultantId || ''];
    const cleanedConsultantIds = Array.from(new Set(consultantIds.filter(Boolean)));
    if (cleanedConsultantIds.length === 0) {
      push({ title: 'Selecione ao menos um consultor.', variant: 'error' });
      return;
    }
    if (!form.title.trim() || !form.start || !form.end) {
      push({ title: 'Preencha título, início e fim.', variant: 'error' });
      return;
    }
    const startDate = new Date(form.start);
    const endDate = new Date(form.end);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      push({ title: 'Datas inválidas. Verifique início e fim.', variant: 'error' });
      return;
    }
    if (endDate <= startDate) {
      push({ title: 'O fim precisa ser depois do início.', variant: 'error' });
      return;
    }
    if (selectedClinics.length === 0) {
      push({ title: 'Selecione ao menos uma clínica.', variant: 'error' });
      return;
    }
    setSaving(true);
    try {
      const startAt = startDate.toISOString();
      const endAt = endDate.toISOString();
      const basePayload = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        start_at: startAt,
        end_at: endAt,
        timezone: form.timezone || 'America/Sao_Paulo',
        location: form.location.trim() || null,
        meeting_url: form.meeting_url.trim() || null,
        recurrence_rule: buildRecurrenceRule(form.recurrence, startAt),
      } as const;

      if (modalMode === 'create') {
        const created: string[] = [];
        const failed: string[] = [];
        for (const consultantId of cleanedConsultantIds) {
          const eventPayload = {
            consultant_id: consultantId,
            status: 'pending_confirmation' as const,
            ...basePayload,
          };
          try {
            await createEvent({ event: eventPayload, clinicIds: selectedClinics });
            created.push(consultantId);
          } catch {
            failed.push(consultantId);
          }
        }
        if (created.length > 0) {
          push({
            title: `Agendamento criado para ${created.length} consultor(es).`,
            variant: 'success',
          });
        }
        if (failed.length > 0) {
          const failedNames = failed
            .map((id) => consultants.find((c) => c.id === id)?.full_name || id.slice(0, 8))
            .join(', ');
          push({
            title: 'Alguns consultores não puderam ser agendados.',
            description: failedNames,
            variant: 'error',
          });
        }
      } else if (selectedEvent) {
        const hasTimeChanged =
          basePayload.start_at !== selectedEvent.start_at || basePayload.end_at !== selectedEvent.end_at;
        const nextStatus =
          selectedEvent.status === 'reschedule_requested' && hasTimeChanged ? 'rescheduled' : selectedEvent.status;
        await updateEvent({
          eventId: selectedEvent.id,
          updates: {
            title: basePayload.title,
            description: basePayload.description,
            start_at: basePayload.start_at,
            end_at: basePayload.end_at,
            timezone: basePayload.timezone,
            location: basePayload.location,
            meeting_url: basePayload.meeting_url,
            recurrence_rule: basePayload.recurrence_rule,
            consultant_id: cleanedConsultantIds[0],
            status: nextStatus,
          },
          clinicIds: selectedClinics,
          forceStatus: nextStatus,
        });

        if (pendingRescheduleRequest && selectedClinics.length) {
          await sb
            .from('schedule_change_requests')
            .update({
              status: 'accepted',
              handled_by: user.id,
              handled_at: new Date().toISOString(),
            })
            .eq('id', pendingRescheduleRequest.id);

          const notificationsPayload = selectedClinics.map((clinicId) => ({
            target: 'clinic',
            clinic_id: clinicId,
            type: 'event_rescheduled',
            payload: {
              event_id: selectedEvent.id,
              clinic_id: clinicId,
              start_at: basePayload.start_at,
              end_at: basePayload.end_at,
              reason: pendingRescheduleRequest.reason,
            },
          }));
          await sb.from('notifications').insert(notificationsPayload);
          setPendingRescheduleRequest(null);
          await loadRescheduleRequests();
        }

        push({ title: 'Agendamento atualizado.', variant: 'success' });
      }
      setModalOpen(false);
      if (range) await fetchEvents(range.end);
    } catch (err: any) {
      const isOverlap =
        err?.code === '23P01' ||
        (typeof err?.message === 'string' && err.message.includes('schedule_events_no_overlap')) ||
        (typeof err?.message === 'string' && err.message.includes('Conflito de horário'));
      push({
        title: isOverlap ? 'Conflito de horário.' : 'Erro ao salvar agendamento.',
        description: isOverlap ? 'Já existe outro agendamento neste horário.' : err?.message,
        variant: 'error',
      });
      if (isOverlap) {
        await handleSuggest();
      }
    } finally {
      setSaving(false);
    }
  };

  const handleSuggest = async () => {
    if (!selectedConsultantId) return;
    if (!form.start || !form.end) {
      push({ title: 'Defina início e fim para sugerir horários.', variant: 'info' });
      return;
    }
    const start = new Date(form.start);
    const end = new Date(form.end);
    const durationMinutes = Math.max(15, Math.round((end.getTime() - start.getTime()) / 60000));
    setSuggesting(true);
    try {
      const slots = await suggestTimeSlots({
        consultantId: selectedConsultantId,
        durationMinutes,
        dateRangeStart: start,
        dateRangeEnd: new Date(start.getTime() + 14 * 24 * 60 * 60000),
        workingHours: { days: [1, 2, 3, 4, 5], start: '09:00', end: '18:00' },
        bufferMinutes: 15,
      });
      setSuggestions(slots);
    } catch (err: any) {
      push({ title: 'Não foi possível sugerir horários.', description: err?.message, variant: 'error' });
    } finally {
      setSuggesting(false);
    }
  };

  const handleEventClick = async (arg: EventClickArg) => {
    const baseEventId = (arg.event.extendedProps?.baseEventId as string | undefined) || arg.event.id;
    const event = events.find((e) => e.id === baseEventId);
    if (!event) return;
    if (event.is_external) {
      setSelectedEvent(event);
      setChangeRequests([]);
      setDrawerOpen(true);
      return;
    }
    setSelectedEvent(event);
    setDrawerOpen(true);
    try {
      const requests = await listChangeRequests(event.id);
      setChangeRequests(requests);
    } catch {
      setChangeRequests([]);
    }
  };

  const handleCancel = async () => {
    if (!selectedEvent) return;
    if (!confirm('Cancelar este agendamento?')) return;
    try {
      await cancelEvent(selectedEvent.id, selectedEvent.attendees.map((a) => a.clinic_id));
      push({ title: 'Agendamento cancelado.', variant: 'success' });
      setDrawerOpen(false);
      if (range) await fetchEvents(range.end);
    } catch (err: any) {
      push({ title: 'Erro ao cancelar agendamento.', description: err?.message, variant: 'error' });
    }
  };

  const handleConsultantConfirm = async (status: 'confirmed' | 'declined') => {
    if (!selectedEvent || !user?.id) return;
    try {
      await updateEvent({
        eventId: selectedEvent.id,
        updates: {
          consultant_confirm_status: status,
          consultant_confirmed_at: new Date().toISOString(),
          consultant_confirmed_by: user.id,
        },
      });
      push({
        title: status === 'confirmed' ? 'Participação confirmada.' : 'Participação recusada.',
        variant: status === 'confirmed' ? 'success' : 'info',
      });
      if (range) await fetchEvents(range.end);
    } catch (err: any) {
      push({ title: 'Erro ao confirmar participação.', description: err?.message, variant: 'error' });
    }
  };

  const handleDelete = async () => {
    if (!selectedEvent) return;
    if (!confirm('Apagar definitivamente este agendamento? Essa ação não poderá ser desfeita.')) return;
    try {
      await deleteEvent(selectedEvent.id, selectedEvent.attendees.map((a) => a.clinic_id));
      push({ title: 'Agendamento removido.', variant: 'success' });
      setDrawerOpen(false);
      if (range) await fetchEvents(range.end);
    } catch (err: any) {
      push({ title: 'Erro ao apagar agendamento.', description: err?.message, variant: 'error' });
    }
  };

  const handleDatesSet = (info: DatesSetArg) => {
    setRange({ start: info.start, end: info.end });
    setCalendarLabel(formatMonthYear(info.view.currentStart));
  };

  const handleSelect = (info: DateSelectArg) => {
    openCreate(info.start, info.end);
  };

  const handleEventDrop = async (info: EventDropArg) => {
    if (info.event.extendedProps?.isExternal) {
      info.revert();
      push({ title: 'Compromisso externo', description: 'Edite este horário no Google Calendar.', variant: 'info' });
      return;
    }
    const baseEventId = (info.event.extendedProps?.baseEventId as string | undefined) || info.event.id;
    const schedule = events.find((event) => event.id === baseEventId);
    if (!schedule || schedule.is_external || !info.event.start || !info.event.end) {
      info.revert();
      return;
    }
    if (schedule.recurrence_rule) {
      info.revert();
      push({ title: 'Série recorrente', description: 'Edite a série pelo formulário do agendamento.', variant: 'info' });
      return;
    }
    try {
      const startAt = info.event.start.toISOString();
      const endAt = info.event.end.toISOString();
      const hasTimeChanged = startAt !== schedule.start_at || endAt !== schedule.end_at;
      const nextStatus =
        schedule.status === 'reschedule_requested' && hasTimeChanged ? 'rescheduled' : schedule.status;
      await updateEvent({
        eventId: schedule.id,
        updates: { start_at: startAt, end_at: endAt },
        forceStatus: nextStatus,
      });
      push({ title: 'Horário atualizado.', variant: 'success' });
      if (range) await fetchEvents(range.end);
    } catch (err: any) {
      info.revert();
      const isOverlap =
        err?.code === '23P01' || (typeof err?.message === 'string' && err.message.includes('schedule_events_no_overlap'));
      push({
        title: isOverlap ? 'Conflito de horário.' : 'Não foi possível mover o agendamento.',
        description: isOverlap ? 'Já existe outro agendamento neste horário.' : err?.message,
        variant: 'error',
      });
    }
  };

  const handleEventResize = async (info: EventResizeDoneArg) => {
    if (info.event.extendedProps?.isExternal) {
      info.revert();
      push({ title: 'Compromisso externo', description: 'Edite este horário no Google Calendar.', variant: 'info' });
      return;
    }
    const baseEventId = (info.event.extendedProps?.baseEventId as string | undefined) || info.event.id;
    const schedule = events.find((event) => event.id === baseEventId);
    if (!schedule || schedule.is_external || !info.event.start || !info.event.end) {
      info.revert();
      return;
    }
    if (schedule.recurrence_rule) {
      info.revert();
      push({ title: 'Série recorrente', description: 'Edite a série pelo formulário do agendamento.', variant: 'info' });
      return;
    }
    try {
      const startAt = info.event.start.toISOString();
      const endAt = info.event.end.toISOString();
      const hasTimeChanged = startAt !== schedule.start_at || endAt !== schedule.end_at;
      const nextStatus =
        schedule.status === 'reschedule_requested' && hasTimeChanged ? 'rescheduled' : schedule.status;
      await updateEvent({
        eventId: schedule.id,
        updates: { start_at: startAt, end_at: endAt },
        forceStatus: nextStatus,
      });
      push({ title: 'Duração atualizada.', variant: 'success' });
      if (range) await fetchEvents(range.end);
    } catch (err: any) {
      info.revert();
      const isOverlap =
        err?.code === '23P01' || (typeof err?.message === 'string' && err.message.includes('schedule_events_no_overlap'));
      push({
        title: isOverlap ? 'Conflito de horário.' : 'Não foi possível redimensionar.',
        description: isOverlap ? 'Já existe outro agendamento neste horário.' : err?.message,
        variant: 'error',
      });
    }
  };

  const handleManualSync = async (options: { silent?: boolean } = {}) => {
    if (!selectedConsultantId) return;
    setSyncingGoogle(true);
    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      if (!token) throw new Error('Sessão inválida. Faça login novamente.');
      const response = await fetch('/api/gcal/sync/pull', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ consultor_id: selectedConsultantId }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.error || 'Falha ao sincronizar.');
      }
      const nowIso = new Date().toISOString();
      setConsultants((prev) =>
        prev.map((consultant) =>
          consultant.id === selectedConsultantId
            ? { ...consultant, last_google_sync_at: nowIso }
            : consultant,
        ),
      );
      if (!options.silent) {
        push({ title: 'Sincronização concluída.', variant: 'success' });
      }
      if (range) await fetchEvents(range.end);
    } catch (err: any) {
      push({ title: 'Erro ao sincronizar.', description: err?.message, variant: 'error' });
    } finally {
      setSyncingGoogle(false);
    }
  };

  useEffect(() => {
    if (!selectedConsultantId || syncingGoogle) return;
    const consultant = selectedConsultant;
    if (!consultant?.google_connected) return;
    const lastSync = consultant.last_google_sync_at ? new Date(consultant.last_google_sync_at).getTime() : 0;
    const now = Date.now();
    const diffMinutes = lastSync ? (now - lastSync) / 60000 : Number.POSITIVE_INFINITY;
    if (diffMinutes < AUTO_SYNC_MINUTES) return;
    const lastAttempt = autoSyncRef.current.get(selectedConsultantId) || 0;
    if (now - lastAttempt < 5 * 60 * 1000) return;
    autoSyncRef.current.set(selectedConsultantId, now);
    void handleManualSync({ silent: true });
  }, [selectedConsultantId, selectedConsultant?.google_connected, selectedConsultant?.last_google_sync_at, syncingGoogle]);

  const switchView = (next: typeof view) => {
    setView(next);
    const api = calendarRef.current?.getApi();
    api?.changeView(next);
  };

  const openRescheduleRequest = async (req: any) => {
    const eventFromState = events.find((event) => event.id === req.event_id);
    const fallbackEvent = req.schedule_events
      ? { ...req.schedule_events, attendees: [] }
      : null;
    const targetEvent = eventFromState || fallbackEvent;
    if (!targetEvent) {
      push({ title: 'Evento não encontrado para reagendar.', variant: 'error' });
      return;
    }
    const clinicIds =
      eventFromState?.attendees?.map((att) => att.clinic_id) || [];
    if (!clinicIds.length) {
      const { data } = await sb
        .from('schedule_event_attendees')
        .select('clinic_id')
        .eq('event_id', targetEvent.id);
      setSelectedClinics((data || []).map((row: any) => row.clinic_id));
    } else {
      setSelectedClinics(clinicIds);
    }
    setSelectedEvent(targetEvent as ScheduleAdminEvent);
    setModalMode('edit');
    setForm({
      title: targetEvent.title,
      description: targetEvent.description || '',
      start: req.suggested_start_at ? toLocalInput(req.suggested_start_at) : toLocalInput(targetEvent.start_at),
      end: req.suggested_end_at ? toLocalInput(req.suggested_end_at) : toLocalInput(targetEvent.end_at),
      timezone: targetEvent.timezone || 'America/Sao_Paulo',
      location: targetEvent.location || '',
      meeting_url: targetEvent.meeting_url || '',
      recurrence: resolveRecurrenceOption(targetEvent.recurrence_rule),
      consultant_id: targetEvent.consultant_id,
      consultant_ids: [targetEvent.consultant_id],
    });
    setPendingRescheduleRequest(req);
    setRescheduleModalOpen(false);
    setModalOpen(true);
  };

  const rejectRescheduleRequest = async (req: any) => {
    if (!user?.id) return;
    try {
      await sb
        .from('schedule_change_requests')
        .update({
          status: 'rejected',
          handled_by: user.id,
          handled_at: new Date().toISOString(),
        })
        .eq('id', req.id);

      const { data: remaining } = await sb
        .from('schedule_change_requests')
        .select('id')
        .eq('event_id', req.event_id)
        .eq('status', 'open')
        .limit(1);

      if (!remaining?.length) {
        const { data: attendees } = await sb
          .from('schedule_event_attendees')
          .select('confirm_status')
          .eq('event_id', req.event_id);
        const hasPending = (attendees || []).some((row: any) => row.confirm_status !== 'confirmed');
        await sb
          .from('schedule_events')
          .update({ status: hasPending ? 'pending_confirmation' : 'confirmed' })
          .eq('id', req.event_id)
          .neq('status', 'cancelled');
      }

      await sb.from('notifications').insert([
        {
          target: 'clinic',
          clinic_id: req.clinic_id,
          type: 'reschedule_rejected',
          payload: { event_id: req.event_id, clinic_id: req.clinic_id, reason: req.reason },
        },
      ]);

      push({ title: 'Solicitação marcada como não reagendada.', variant: 'success' });
      await loadRescheduleRequests();
      if (range) await fetchEvents(range.end);
    } catch (err: any) {
      push({ title: 'Não foi possível atualizar a solicitação.', description: err?.message, variant: 'error' });
    }
  };

  const approveHelperRequest = async (req: any) => {
    if (!user?.id) return;
    try {
      await sb
        .from('clinic_helper_agenda_requests')
        .update({
          status: 'confirmed',
          handled_by: user.id,
          handled_at: new Date().toISOString(),
        })
        .eq('id', req.id);

      await sb.from('notifications').insert([
        {
          target: 'clinic',
          clinic_id: req.clinic_id,
          type: 'helper_agenda_confirmed',
          payload: {
            request_id: req.id,
            clinic_id: req.clinic_id,
            preferred_start_at: req.preferred_start_at,
            preferred_end_at: req.preferred_end_at,
          },
        },
      ]);

      push({ title: 'Solicitação aprovada.', variant: 'success' });
      await loadHelperRequests();
    } catch (err: any) {
      push({ title: 'Não foi possível aprovar.', description: err?.message, variant: 'error' });
    }
  };

  const rejectHelperRequest = async (req: any) => {
    if (!user?.id) return;
    try {
      await sb
        .from('clinic_helper_agenda_requests')
        .update({
          status: 'rejected',
          handled_by: user.id,
          handled_at: new Date().toISOString(),
        })
        .eq('id', req.id);

      await sb.from('notifications').insert([
        {
          target: 'clinic',
          clinic_id: req.clinic_id,
          type: 'helper_agenda_rejected',
          payload: {
            request_id: req.id,
            clinic_id: req.clinic_id,
            reason: req.reason,
          },
        },
      ]);

      push({ title: 'Solicitação rejeitada.', variant: 'success' });
      await loadHelperRequests();
    } catch (err: any) {
      push({ title: 'Não foi possível rejeitar.', description: err?.message, variant: 'error' });
    }
  };

  if (!isSystemAdmin && !isOneDoctorInternal) {
    return <div className="text-sm text-gray-500">Acesso restrito aos consultores One Doctor.</div>;
  }

  return (
    <div className="space-y-6">
      <ToastStack items={toasts} onDismiss={dismiss} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Agendamento Inteligente</h1>
          <p className="text-sm text-gray-500">Admin • Agenda do consultor</p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          {!isConsultantOnly && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Consultor</span>
              <select
                className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white text-gray-700"
                value={selectedConsultantId || ''}
                onChange={(event) => setSelectedConsultantId(event.target.value || null)}
              >
                {consultants.length === 0 && <option value="">Carregando...</option>}
                {consultants.map((consultant) => (
                  <option key={consultant.id} value={consultant.id}>
                    {consultant.full_name || consultant.id.slice(0, 8)}
                    {consultant.google_connected ? ' • Google conectado' : ''}
                  </option>
                ))}
              </select>
            </div>
          )}
          {!isConsultantOnly && rescheduleRequests.length > 0 && (
            <button
              type="button"
              onClick={() => setRescheduleModalOpen(true)}
              className="px-3 py-2 text-sm rounded-lg bg-amber-600 text-white flex items-center gap-2 shadow-sm hover:bg-amber-700"
            >
              Solicitações ({rescheduleRequests.length})
            </button>
          )}
          {!isConsultantOnly && helperRequests.length > 0 && (
            <button
              type="button"
              onClick={() => setHelperModalOpen(true)}
              className="px-3 py-2 text-sm rounded-lg bg-indigo-600 text-white flex items-center gap-2 shadow-sm hover:bg-indigo-700"
            >
              Helpers ({helperRequests.length})
            </button>
          )}
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
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleManualSync()}
              disabled={syncingGoogle}
              className="px-3 py-2 text-sm border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-60"
            >
              {syncingGoogle ? 'Sincronizando...' : 'Sincronizar Google'}
            </button>
            <span className="text-[11px] text-gray-500 leading-tight max-w-[240px]">
              {lastSyncLabel} • Auto-sync a cada {AUTO_SYNC_MINUTES} min quando conectado.
            </span>
          </div>
          <button
            type="button"
            onClick={() => openCreate()}
            className="px-4 py-2 rounded-lg bg-brand-600 text-white flex items-center gap-2"
          >
            <Plus size={16} /> Criar agendamento
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px] gap-4">
        <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between gap-2 text-sm text-gray-500 mb-1">
            <Calendar size={16} /> {loading ? 'Carregando agenda...' : 'Agenda do consultor'}
          </div>
          <div className="mb-3 text-lg font-semibold text-gray-800">
            {selectedConsultant?.full_name ? `Consultor: ${selectedConsultant.full_name}` : 'Consultor —'}
            <span className="ml-2 text-sm font-normal text-gray-500">{calendarLabel || '—'}</span>
          </div>
          <FullCalendar
            ref={calendarRef}
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            initialView={view}
            height="auto"
            selectable
            editable
            eventResizableFromStart
            eventTimeFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
            slotLabelFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
            events={calendarEvents}
            select={handleSelect}
            eventClick={handleEventClick}
            eventDrop={handleEventDrop}
            eventResize={handleEventResize}
            datesSet={handleDatesSet}
            headerToolbar={false}
            dayMaxEventRows
            nowIndicator
          />
        </div>

        <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3">
            Próximos agendamentos do consultor
          </div>
          {upcoming.length === 0 && (
            <p className="text-sm text-gray-500">Nenhum agendamento futuro encontrado.</p>
          )}
          <div className="space-y-3">
            {upcoming.map((event) => {
              const eventBadge = resolveEventBadge(event);
              const consultantBadge = resolveStatusBadge(event.consultant_confirm_status);
              return (
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
                  <div className="text-xs text-gray-500">
                    {formatDateTime(event.start_at)} • {formatDateTime(event.end_at)}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <span>Status:</span>
                      <span className={`px-2 py-1 rounded-full text-[10px] font-semibold ${eventBadge.className}`}>
                        {eventBadge.label}
                      </span>
                    </span>
                    {!event.is_external && (
                      <span className="flex items-center gap-1">
                        <span>Consultor:</span>
                        <span className={`px-2 py-1 rounded-full text-[10px] font-semibold ${consultantBadge.className}`}>
                          {consultantBadge.label}
                        </span>
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <EventModal
        open={modalOpen}
        mode={modalMode}
        form={form}
        clinics={clinics}
        consultants={consultants.map((c) => ({
          id: c.id,
          name: c.full_name || c.id.slice(0, 8),
          google_connected: c.google_connected ?? null,
        }))}
        consultantLocked={isConsultantOnly}
        allowMultiConsultant={modalMode === 'create'}
        selectedConsultants={selectedConsultantIds}
        selectedClinics={selectedClinics}
        suggestions={suggestions}
        saving={saving}
        suggesting={suggesting}
        onChange={(patch) => setForm((prev) => ({ ...prev, ...patch }))}
        onSelectConsultant={(id) => setSelectedConsultantId(id || null)}
        onToggleConsultant={(id) =>
          setSelectedConsultantIds((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]))
        }
        onToggleClinic={(id) =>
          setSelectedClinics((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]))
        }
        onSave={handleSave}
        onSuggest={handleSuggest}
        onClose={() => setModalOpen(false)}
      />

      <EventDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        event={selectedEvent}
        attendees={selectedEvent?.attendees || []}
        changeRequests={changeRequests}
        isExternal={Boolean(selectedEvent?.is_external)}
        readOnly={Boolean(selectedEvent?.is_external)}
        externalAttendees={selectedEvent?.external_block?.attendees || []}
        externalLink={selectedEvent?.external_block?.html_link || null}
        onEdit={
          selectedEvent && (!isConsultantOnly || selectedEvent.consultant_id === user?.id)
            ? () => {
                if (selectedEvent) {
                  openEdit(selectedEvent);
                  setDrawerOpen(false);
                }
              }
            : undefined
        }
        onCancel={
          selectedEvent && (!isConsultantOnly || selectedEvent.consultant_id === user?.id)
            ? handleCancel
            : undefined
        }
        onDelete={handleDelete}
        consultantView={isConsultantOnly}
        onConsultantConfirm={handleConsultantConfirm}
      />

      {rescheduleModalOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center overflow-y-auto py-8"
          onClick={rescheduleModalControls.onBackdropClick}
        >
          <div
            className="bg-white w-full max-w-3xl rounded-2xl p-6 shadow-xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-800">Solicitações de reagendamento</h3>
                <p className="text-sm text-gray-500">Acompanhe os pedidos das clínicas.</p>
              </div>
              <button
                type="button"
                onClick={() => setRescheduleModalOpen(false)}
                className="w-9 h-9 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            {rescheduleLoading && (
              <p className="text-sm text-gray-500">Carregando solicitações...</p>
            )}
            {!rescheduleLoading && rescheduleRequests.length === 0 && (
              <p className="text-sm text-gray-500">Nenhuma solicitação aberta.</p>
            )}

            {!rescheduleLoading && rescheduleRequests.length > 0 && (
              <div className="space-y-3">
                {rescheduleRequests.map((req) => (
                  <div key={req.id} className="border border-gray-100 rounded-xl p-4 text-sm text-gray-600">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="font-semibold text-gray-800">
                        Clínica: {req.clinics?.name || req.clinic_id}
                      </div>
                      <div className="text-xs text-gray-400">{formatDateTime(req.created_at)}</div>
                    </div>
                    <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-gray-500">
                      <div>Início sugerido: {formatDateTime(req.suggested_start_at)}</div>
                      <div>Fim sugerido: {formatDateTime(req.suggested_end_at)}</div>
                    </div>
                    <div className="mt-2 text-sm text-gray-700">{req.reason}</div>
                    {req.schedule_events && (
                      <div className="mt-2 text-xs text-gray-500">
                        Evento: {req.schedule_events.title} • {formatDateTime(req.schedule_events.start_at)} → {formatDateTime(req.schedule_events.end_at)}
                      </div>
                    )}
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => openRescheduleRequest(req)}
                        className="px-3 py-2 text-xs rounded-lg bg-brand-600 text-white hover:bg-brand-700"
                      >
                        Reagendar
                      </button>
                      <button
                        type="button"
                        onClick={() => rejectRescheduleRequest(req)}
                        className="px-3 py-2 text-xs rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
                      >
                        Não reagendado
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {helperModalOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center overflow-y-auto py-8"
          onClick={() => setHelperModalOpen(false)}
        >
          <div
            className="bg-white w-full max-w-3xl rounded-2xl p-6 shadow-xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-800">Solicitações de helpers</h3>
                <p className="text-sm text-gray-500">Pedidos de agenda extraordinária das clínicas.</p>
              </div>
              <button
                type="button"
                onClick={() => setHelperModalOpen(false)}
                className="w-9 h-9 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            {helperLoading && (
              <p className="text-sm text-gray-500">Carregando solicitações...</p>
            )}
            {!helperLoading && helperRequests.length === 0 && (
              <p className="text-sm text-gray-500">Nenhuma solicitação pendente.</p>
            )}

            {!helperLoading && helperRequests.length > 0 && (
              <div className="space-y-3">
                {helperRequests.map((req) => (
                  <div key={req.id} className="border border-gray-100 rounded-xl p-4 text-sm text-gray-600">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="font-semibold text-gray-800">
                        Clínica: {req.clinics?.name || req.clinic_id}
                      </div>
                      <div className="text-xs text-gray-400">{formatDateTime(req.created_at)}</div>
                    </div>
                    <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-gray-500">
                      <div>Início desejado: {formatDateTime(req.preferred_start_at)}</div>
                      <div>Fim sugerido: {formatDateTime(req.preferred_end_at)}</div>
                    </div>
                    <div className="mt-2 text-sm text-gray-700">{req.reason}</div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => approveHelperRequest(req)}
                        className="px-3 py-2 text-xs rounded-lg bg-brand-600 text-white hover:bg-brand-700"
                      >
                        Aprovar
                      </button>
                      <button
                        type="button"
                        onClick={() => rejectHelperRequest(req)}
                        className="px-3 py-2 text-xs rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
                      >
                        Rejeitar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminAgenda;
