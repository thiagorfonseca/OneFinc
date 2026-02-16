import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../src/auth/AuthProvider';

const USER_AVATAR_BUCKET = 'user-avatars';
const MAX_AVATAR_DIMENSION = 350;

const toSafeFileName = (name: string) => {
  const withoutAccents = name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
  const cleaned = withoutAccents.replace(/[^a-zA-Z0-9._-]+/g, '-');
  const trimmed = cleaned.replace(/-+/g, '-').replace(/^-+|-+$/g, '');
  return trimmed || `file-${crypto.randomUUID()}`;
};

const readImageDimensions = (file: File) =>
  new Promise<{ width: number; height: number }>((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.width, height: img.height });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Imagem inválida.'));
    };
    img.src = url;
  });

const validateAvatarFile = async (file: File) => {
  if (!file.type.startsWith('image/')) return 'Envie um arquivo de imagem.';
  try {
    const { width, height } = await readImageDimensions(file);
    if (width !== height) return 'A imagem precisa ser quadrada.';
    if (width > MAX_AVATAR_DIMENSION || height > MAX_AVATAR_DIMENSION) {
      return `A imagem deve ter no máximo ${MAX_AVATAR_DIMENSION} x ${MAX_AVATAR_DIMENSION}px.`;
    }
    return null;
  } catch {
    return 'Não foi possível ler a imagem.';
  }
};

const uploadProfileAvatar = async (userId: string, file: File) => {
  const safeName = toSafeFileName(file.name);
  const path = `users/${userId}/${crypto.randomUUID()}-${safeName}`;
  const { error } = await supabase.storage.from(USER_AVATAR_BUCKET).upload(path, file, { upsert: true });
  if (error) throw error;
  const { data } = supabase.storage.from(USER_AVATAR_BUCKET).getPublicUrl(path);
  return data.publicUrl;
};

const Profile: React.FC = () => {
  const { user, profile, clinicUser, refresh } = useAuth();
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);

  const [noteId, setNoteId] = useState<string | null>(null);
  const [noteContent, setNoteContent] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [noteMessage, setNoteMessage] = useState<string | null>(null);

  const [googleCalendarLink, setGoogleCalendarLink] = useState((profile as any)?.google_calendar_link || '');
  const [googleCalendarId, setGoogleCalendarId] = useState((profile as any)?.google_calendar_id || '');
  const [googleConnected, setGoogleConnected] = useState(Boolean((profile as any)?.google_connected));
  const [savingCalendar, setSavingCalendar] = useState(false);
  const [calendarMessage, setCalendarMessage] = useState<string | null>(null);

  useEffect(() => {
    setFullName(profile?.full_name || '');
  }, [profile?.full_name]);

  useEffect(() => {
    setGoogleCalendarLink((profile as any)?.google_calendar_link || '');
    setGoogleCalendarId((profile as any)?.google_calendar_id || '');
    setGoogleConnected(Boolean((profile as any)?.google_connected));
  }, [profile]);

  useEffect(() => {
    return () => {
      if (avatarPreview?.startsWith('blob:')) {
        URL.revokeObjectURL(avatarPreview);
      }
    };
  }, [avatarPreview]);

  useEffect(() => {
    const loadNotes = async () => {
      if (!user?.id) return;
      const { data } = await supabase
        .from('user_notes')
        .select('id, content')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) {
        setNoteId(data.id);
        setNoteContent(data.content || '');
      }
    };
    loadNotes();
  }, [user?.id]);

  const handleAvatarChange = async (file: File) => {
    const error = await validateAvatarFile(file);
    if (error) {
      setAvatarError(error);
      setAvatarFile(null);
      setAvatarPreview(null);
      return;
    }
    setAvatarError(null);
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const handleSaveProfile = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user) return;
    if (!fullName.trim()) {
      setProfileMessage('Informe seu nome.');
      return;
    }
    if (avatarError && avatarFile) {
      setProfileMessage(avatarError);
      return;
    }
    setSavingProfile(true);
    setProfileMessage(null);
    let avatarUrl = profile?.avatar_url ?? clinicUser?.avatar_url ?? null;
    if (avatarFile) {
      try {
        avatarUrl = await uploadProfileAvatar(user.id, avatarFile);
      } catch (error) {
        setProfileMessage(`Erro ao enviar imagem: ${(error as Error).message}`);
        setSavingProfile(false);
        return;
      }
    }
    const { error } = await supabase
      .from('profiles')
      .upsert({
        id: user.id,
        full_name: fullName.trim(),
        clinic_id: profile?.clinic_id ?? null,
        role: profile?.role ?? null,
        avatar_url: avatarUrl,
      });
    if (error) {
      setProfileMessage('Erro ao salvar perfil: ' + error.message);
    } else {
      setProfileMessage('Perfil atualizado com sucesso.');
      setAvatarFile(null);
      setAvatarPreview(null);
      await refresh();
    }
    setSavingProfile(false);
  };

  const handleSaveCalendar = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user) return;
    setSavingCalendar(true);
    setCalendarMessage(null);
    const { error } = await (supabase as any)
      .from('profiles')
      .update({
        google_calendar_link: googleCalendarLink.trim() || null,
      })
      .eq('id', user.id);
    if (error) {
      setCalendarMessage('Erro ao salvar link do calendário: ' + error.message);
    } else {
      setCalendarMessage('Link do calendário salvo.');
      await refresh();
    }
    setSavingCalendar(false);
  };

  const handleConnectGoogle = async () => {
    if (!user?.id) return;
    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;
    if (!token) {
      setCalendarMessage('Sessão inválida. Faça login novamente.');
      return;
    }
    const response = await fetch(
      `/api/gcal/oauth/start?consultor_id=${user.id}&return_to=/profile?gcal=connected&format=json`,
      { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } }
    );
    if (!response.ok) {
      setCalendarMessage('Não foi possível iniciar a conexão com o Google.');
      return;
    }
    const data = await response.json().catch(() => ({}));
    if (!data?.url) {
      setCalendarMessage('Resposta inválida do Google OAuth.');
      return;
    }
    window.location.href = data.url;
  };

  const handlePasswordChange = async (event: React.FormEvent) => {
    event.preventDefault();
    setPasswordMessage(null);
    if (password.length < 6) {
      setPasswordMessage('A senha precisa ter pelo menos 6 caracteres.');
      return;
    }
    if (password !== confirmPassword) {
      setPasswordMessage('As senhas não conferem.');
      return;
    }
    setSavingPassword(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setPasswordMessage('Erro ao atualizar senha: ' + error.message);
    } else {
      setPasswordMessage('Senha atualizada com sucesso.');
      setPassword('');
      setConfirmPassword('');
    }
    setSavingPassword(false);
  };

  const handleSaveNote = async () => {
    if (!user?.id) return;
    setSavingNote(true);
    setNoteMessage(null);
    const { error } = await supabase
      .from('user_notes')
      .upsert(
        {
          id: noteId || undefined,
          user_id: user.id,
          content: noteContent,
        },
        { onConflict: 'user_id' }
      );
    if (error) {
      setNoteMessage('Erro ao salvar anotação: ' + error.message);
    } else {
      setNoteMessage('Anotação salva.');
    }
    setSavingNote(false);
  };

  const avatarSrc = avatarPreview || profile?.avatar_url || clinicUser?.avatar_url || '';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Meu perfil</h1>
        <p className="text-gray-500">Gerencie seus dados pessoais, senha e anotações.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <form onSubmit={handleSaveProfile} className="bg-white border border-gray-100 rounded-xl p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-800">Dados pessoais</h2>
          <div className="flex flex-wrap items-center gap-4">
            <div className="h-20 w-20 rounded-xl border border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden text-[10px] text-gray-400">
              {avatarSrc ? (
                <img src={avatarSrc} alt="Imagem do perfil" className="h-full w-full object-cover" />
              ) : (
                <span>Sem imagem</span>
              )}
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Imagem do perfil</label>
              <label className="inline-flex px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                {avatarSrc ? 'Trocar imagem' : 'Adicionar imagem'}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) await handleAvatarChange(file);
                    e.currentTarget.value = '';
                  }}
                />
              </label>
              <p className="text-xs text-gray-500">Quadrada até 350 x 350.</p>
              {avatarError && <p className="text-xs text-red-600">{avatarError}</p>}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Nome</label>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-brand-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Email</label>
            <input
              value={user?.email || ''}
              readOnly
              className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-500"
            />
          </div>
          {profileMessage && <p className="text-sm text-gray-500">{profileMessage}</p>}
          <button
            type="submit"
            disabled={savingProfile}
            className="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50"
          >
            {savingProfile ? 'Salvando...' : 'Salvar alterações'}
          </button>
        </form>

        <form onSubmit={handlePasswordChange} className="bg-white border border-gray-100 rounded-xl p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-800">Alterar senha</h2>
          <div>
            <label className="block text-sm font-medium text-gray-700">Nova senha</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-brand-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Confirmar senha</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-brand-500 outline-none"
            />
          </div>
          {passwordMessage && <p className="text-sm text-gray-500">{passwordMessage}</p>}
          <button
            type="submit"
            disabled={savingPassword}
            className="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50"
          >
            {savingPassword ? 'Atualizando...' : 'Atualizar senha'}
          </button>
        </form>

        <form onSubmit={handleSaveCalendar} className="bg-white border border-gray-100 rounded-xl p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-800">Google Calendar</h2>
          <p className="text-sm text-gray-500">
            Conecte seu calendário para sincronizar a agenda do consultor.
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Link do Google Calendar</label>
            <input
              type="text"
              value={googleCalendarLink}
              onChange={(e) => setGoogleCalendarLink(e.target.value)}
              placeholder="Cole o link compartilhado do Google Calendar"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className={`px-2 py-1 rounded-full text-xs ${googleConnected ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
              {googleConnected ? 'Conectado' : 'Não conectado'}
            </span>
            {googleCalendarId ? (
              <span className="text-xs text-gray-500">Calendar ID: {googleCalendarId}</span>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={savingCalendar}
              className="px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {savingCalendar ? 'Salvando...' : 'Salvar link'}
            </button>
            <button
              type="button"
              onClick={handleConnectGoogle}
              className="px-4 py-2 rounded-lg text-sm bg-brand-600 text-white hover:bg-brand-700"
            >
              Conectar Google Calendar
            </button>
          </div>
          {calendarMessage && <p className="text-xs text-gray-600">{calendarMessage}</p>}
        </form>
      </div>

      <div className="bg-white border border-gray-100 rounded-xl p-6 space-y-3">
        <h2 className="text-lg font-semibold text-gray-800">Minhas anotações</h2>
        <textarea
          value={noteContent}
          onChange={(e) => setNoteContent(e.target.value)}
          rows={6}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-brand-500 outline-none"
          placeholder="Escreva suas anotações aqui..."
        />
        {noteMessage && <p className="text-sm text-gray-500">{noteMessage}</p>}
        <button
          type="button"
          onClick={handleSaveNote}
          disabled={savingNote}
          className="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50"
        >
          {savingNote ? 'Salvando...' : 'Salvar anotações'}
        </button>
      </div>
    </div>
  );
};

export default Profile;
