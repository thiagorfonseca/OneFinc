export type ScheduleStatus =
  | 'pending_confirmation'
  | 'confirmed'
  | 'cancelled'
  | 'reschedule_requested'
  | 'rescheduled';

export type ScheduleConfirmStatus = 'pending' | 'confirmed' | 'declined';

export type ScheduleChangeStatus = 'open' | 'accepted' | 'rejected' | 'cancelled';

export type ScheduleEvent = {
  id: string;
  consultant_id: string;
  title: string;
  description?: string | null;
  start_at: string;
  end_at: string;
  timezone: string;
  location?: string | null;
  meeting_url?: string | null;
  status: ScheduleStatus;
  recurrence_rule?: string | null;
  google_event_id?: string | null;
  google_etag?: string | null;
  google_calendar_id?: string | null;
  external_origin?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type ScheduleEventAttendee = {
  event_id: string;
  clinic_id: string;
  confirm_status: ScheduleConfirmStatus;
  confirmed_by?: string | null;
  confirmed_at?: string | null;
  clinic?: { id: string; name: string };
};

export type ScheduleChangeRequest = {
  id: string;
  event_id: string;
  clinic_id: string;
  requested_by: string;
  reason: string;
  suggested_start_at?: string | null;
  suggested_end_at?: string | null;
  status: ScheduleChangeStatus;
  handled_by?: string | null;
  handled_at?: string | null;
  created_at?: string | null;
};

export type ScheduleNotification = {
  id: string;
  target: 'one_doctor' | 'clinic';
  clinic_id?: string | null;
  to_user_id?: string | null;
  type: string;
  payload: Record<string, any>;
  read_at?: string | null;
  created_at?: string | null;
};

export type ScheduleEventWithAttendees = ScheduleEvent & {
  attendees: ScheduleEventAttendee[];
};

export type ScheduleExternalBlock = {
  id: string;
  clinic_id: string;
  consultant_id: string;
  start_at: string;
  end_at: string;
  all_day: boolean;
  summary?: string | null;
  status: 'confirmed' | 'cancelled';
  google_event_id: string;
  google_updated?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type ScheduleAdminEvent = ScheduleEventWithAttendees & {
  is_external?: boolean;
  external_block?: ScheduleExternalBlock;
};

export type ScheduleEventForClinic = ScheduleEvent & {
  confirm_status: ScheduleConfirmStatus;
  confirmed_at?: string | null;
};

export type SuggestedSlot = {
  start: string;
  end: string;
};

export type WorkingHoursRule = {
  days: number[];
  start: string;
  end: string;
};
