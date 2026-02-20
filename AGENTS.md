# AGENTS — Controle Clinic

Este arquivo resume instruções operacionais para agentes de IA.

## Runbook rápido — Troca de Clínica (System Admin)

**Sintoma**  
System admin troca a clínica no seletor, mas a UI continua mostrando dados da clínica anterior.

**Causa**  
RLS depende de `profiles.clinic_id`. Se o front muda o estado local antes de persistir esse campo, as queries rodam com a clínica antiga.

**Correção padrão**
1. Atualizar `profiles.clinic_id` no Supabase ao trocar a clínica.
2. Só atualizar `selectedClinicId`/estado local **após** o update confirmar.
3. Carregar dados usando `effectiveClinicId`.

**Referência**  
Veja o runbook completo em `ARCHITECTURE.md`.
