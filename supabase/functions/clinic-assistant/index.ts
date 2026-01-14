import { serve } from "https://deno.land/std@0.204.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.86.2";

/**
 * CONFIG CORS
 * - Configure a env ALLOWED_ORIGINS com domínios separados por vírgula:
 *   ex: "https://app.seudominio.com,https://staging.seudominio.com"
 * - Se não configurar, libera apenas localhost (dev).
 */
const allowedOrigins = (() => {
  const raw = Deno.env.get("ALLOWED_ORIGINS") || "";
  const list = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  // fallback seguro: somente dev local
  if (list.length === 0) {
    return ["http://localhost:5173", "http://127.0.0.1:5173", "http://127.0.0.1:3000"];
  }
  return list;
})();

const isAllowedOrigin = (origin: string | null) => {
  // Requests sem Origin costumam ser server-to-server (não browser). Permitimos.
  if (!origin) return true;
  return allowedOrigins.includes(origin);
};

const getCorsHeaders = (origin: string | null) => {
  const allowOrigin = origin && allowedOrigins.includes(origin) ? origin : "";
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
};

const jsonResponse = (origin: string | null, status: number, payload: unknown) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...getCorsHeaders(origin), "Content-Type": "application/json" },
  });

const formatBrl = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value || 0);

const normalizeText = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

const detectDays = (text: string) => {
  const match = text.match(/(\d{1,3})/);
  if (match) {
    const days = Number(match[1]);
    if (!Number.isNaN(days) && days > 0) return Math.min(days, 365);
  }

  if (text.includes("quinzena") || text.includes("quinzenal")) return 15;
  if (text.includes("semana")) return 7;
  if (text.includes("trimestre") || text.includes("trimestral")) return 90;
  if (text.includes("semestre") || text.includes("semestral")) return 180;
  if (text.includes("ano") || text.includes("anual")) return 365;
  if (text.includes("mes") || text.includes("mensal") || text.includes("mês")) return 30;
  if (text.includes("hoje")) return 1;

  return 30;
};

const detectIntent = (text: string) => {
  if (text.includes("receber") || text.includes("recebive") || text.includes("a receber")) return "recebiveis";
  if (text.includes("receita") || text.includes("faturamento") || text.includes("entrada")) return "recebiveis";
  if (text.includes("pagar") || text.includes("despesa")) return "despesas";
  if (text.includes("gasto") || text.includes("saida") || text.includes("saída")) return "despesas";
  if (text.includes("saldo") || text.includes("projetado") || text.includes("projecao") || text.includes("fluxo"))
    return "saldo";
  if (text.includes("procedimento") || text.includes("procedimentos")) return "procedimentos";
  return "unknown";
};

const parseJson = (value: string) => {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const clampDays = (value: number) => {
  if (Number.isNaN(value) || value <= 0) return 30;
  return Math.min(value, 365);
};

const detectWithLlm = async (question: string) => {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) return null;

  const model = Deno.env.get("OPENAI_MODEL") || "gpt-4o-mini";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        messages: [
          {
            role: "system",
            content:
              'Classifique a pergunta financeira. Responda APENAS com JSON válido no formato {"intent":"recebiveis|despesas|saldo|procedimentos|unknown","days":number}. Se não houver período explícito, use 30. Se houver expressões como "próxima semana" (7), "quinzena" (15), "próximo mês" (30), "trimestre" (90), "semestre" (180), "ano" (365). Não inclua texto extra.',
          },
          { role: "user", content: question },
        ],
      }),
      signal: controller.signal,
    });

    if (!response.ok) return null;

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content?.trim();
    if (!content) return null;

    const parsed = parseJson(content);
    if (!parsed || typeof parsed !== "object") return null;

    const intent = typeof parsed.intent === "string" ? parsed.intent : "unknown";
    const days = clampDays(Number(parsed.days ?? 30));
    return { intent, days };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
};

serve(async (req) => {
  const origin = req.headers.get("Origin");
  const corsHeaders = getCorsHeaders(origin);

  // CORS preflight
  if (req.method === "OPTIONS") {
    if (!isAllowedOrigin(origin)) {
      return jsonResponse(origin, 403, { error: "Origem não permitida (CORS)." });
    }
    return new Response("ok", { headers: corsHeaders });
  }

  // Bloqueia browser fora da whitelist
  if (!isAllowedOrigin(origin)) {
    return jsonResponse(origin, 403, { error: "Origem não permitida (CORS)." });
  }

  if (req.method !== "POST") {
    return jsonResponse(origin, 405, { error: "Método não permitido" });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");

  if (!supabaseUrl || !supabaseServiceKey || !supabaseAnonKey) {
    return jsonResponse(origin, 500, { error: "Configuração do Supabase ausente." });
  }

  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace("Bearer ", "").trim();
  if (!token) {
    return jsonResponse(origin, 401, { error: "Token inválido." });
  }

  // Cliente que valida o token do usuário
  const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  // Cliente admin (service role) para RPCs e logs
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

  const { data: authData, error: authError } = await supabaseUser.auth.getUser();
  if (authError || !authData?.user) {
    return jsonResponse(origin, 401, { error: "Usuário não autenticado." });
  }

  const user = authData.user;

  let body: { message?: string; clinic_id?: string } = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const question = (body.message || "").trim();
  if (!question) {
    return jsonResponse(origin, 400, { error: "Pergunta não informada." });
  }

  // Descobre perfil do usuário (role + clinic_id)
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role, clinic_id")
    .eq("id", user.id)
    .maybeSingle();

  const isSystemAdmin = profile?.role === "system_owner" || profile?.role === "super_admin";
  const profileClinicId = profile?.clinic_id || null;

  let clinicId = body.clinic_id || null;

  // Se NÃO for admin do sistema, valida clinic_id contra perfil/membership
  if (!isSystemAdmin) {
    if (clinicId) {
      if (profileClinicId && clinicId === profileClinicId) {
        // ok
      } else {
        const { data: membership } = await supabaseAdmin
          .from("clinic_users")
          .select("clinic_id")
          .eq("user_id", user.id)
          .eq("clinic_id", clinicId)
          .eq("ativo", true)
          .maybeSingle();

        if (!membership?.clinic_id) {
          return jsonResponse(origin, 403, { error: "Sem acesso à clínica solicitada." });
        }
      }
    } else if (profileClinicId) {
      clinicId = profileClinicId;
    } else {
      const { data: membership } = await supabaseAdmin
        .from("clinic_users")
        .select("clinic_id")
        .eq("user_id", user.id)
        .eq("ativo", true)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      clinicId = membership?.clinic_id || null;
    }
  }

  if (!clinicId) {
    return jsonResponse(origin, 400, { error: "Clínica não encontrada para este usuário." });
  }

  // Detecta intenção/período
  const normalized = normalizeText(question);
  const llmResult = await detectWithLlm(question);
  const intent = llmResult?.intent || detectIntent(normalized);
  const days = llmResult?.days || detectDays(normalized);

  let responseText = "";
  let toolCalled = intent;
  let sqlExecuted: string | null = null;
  let resultJson: any = null;

  try {
    if (intent === "recebiveis") {
      const { data } = await supabaseAdmin.rpc("get_receivables_summary", {
        p_clinic_id: clinicId,
        p_days: days,
      });
      resultJson = data;
      sqlExecuted = `select * from get_receivables_summary('${clinicId}', ${days})`;

      if (!data || data.length === 0) {
        responseText = `Não encontrei recebíveis nos próximos ${days} dias.`;
      } else {
        const total = data.reduce((sum: number, row: any) => sum + Number(row.total || 0), 0);
        const details = data
          .map((row: any) => `- ${row.category || "Sem categoria"}: ${formatBrl(Number(row.total || 0))}`)
          .join("\n");
        responseText = `Nos próximos ${days} dias você tem ${formatBrl(total)} a receber.\nDetalhamento:\n${details}`;
      }
    } else if (intent === "despesas") {
      const { data } = await supabaseAdmin.rpc("get_payables_summary", {
        p_clinic_id: clinicId,
        p_days: days,
      });
      resultJson = data;
      sqlExecuted = `select * from get_payables_summary('${clinicId}', ${days})`;

      if (!data || data.length === 0) {
        responseText = `Não encontrei despesas nos próximos ${days} dias.`;
      } else {
        const total = data.reduce((sum: number, row: any) => sum + Number(row.total || 0), 0);
        const details = data
          .map((row: any) => `- ${row.category || "Sem categoria"}: ${formatBrl(Number(row.total || 0))}`)
          .join("\n");
        responseText = `Nos próximos ${days} dias você tem ${formatBrl(total)} em despesas.\nDetalhamento:\n${details}`;
      }
    } else if (intent === "saldo") {
      const { data } = await supabaseAdmin.rpc("get_cashflow_projection", {
        p_clinic_id: clinicId,
        p_days: days,
      });
      resultJson = data;
      sqlExecuted = `select * from get_cashflow_projection('${clinicId}', ${days})`;

      const row = data?.[0];
      if (!row) {
        responseText = `Não encontrei dados para projetar saldo nos próximos ${days} dias.`;
      } else {
        responseText =
          `Saldo projetado para os próximos ${days} dias: ${formatBrl(Number(row.saldo || 0))}.\n` +
          `Receber: ${formatBrl(Number(row.total_receber || 0))}\n` +
          `Pagar: ${formatBrl(Number(row.total_pagar || 0))}`;
      }
    } else if (intent === "procedimentos") {
      const { data } = await supabaseAdmin.rpc("get_top_procedures_profitability", {
        p_clinic_id: clinicId,
        p_days: days,
      });
      resultJson = data;
      sqlExecuted = `select * from get_top_procedures_profitability('${clinicId}', ${days})`;

      if (!data || data.length === 0) {
        responseText = `Não encontrei procedimentos nos últimos ${days} dias.`;
      } else {
        const details = data
          .map((row: any) => `- ${row.procedimento}: ${formatBrl(Number(row.lucro || 0))}`)
          .join("\n");
        responseText = `Top procedimentos por lucro nos últimos ${days} dias:\n${details}`;
      }
    } else {
      responseText =
        "Posso responder perguntas financeiras como recebíveis, despesas ou saldo projetado. Ex: 'Quanto tenho a receber nos próximos 30 dias?'.";
      toolCalled = "unknown";
    }
  } catch (_error) {
    responseText = "Erro ao consultar dados financeiros.";
  }

  // Logs
  await supabaseAdmin.from("ai_chat_logs").insert([
    {
      clinic_id: clinicId,
      user_id: user.id,
      question,
      tool_called: toolCalled,
      sql_executed: sqlExecuted,
      result_json: resultJson,
      response_text: responseText,
    },
  ]);

  await supabaseAdmin.from("ai_chat_messages").insert([
    { clinic_id: clinicId, user_id: user.id, role: "user", content: question },
    { clinic_id: clinicId, user_id: user.id, role: "assistant", content: responseText },
  ]);

  return new Response(JSON.stringify({ answer: responseText }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});