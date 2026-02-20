# Controle Clinic — Arquitetura, Segurança e Multiusuário

Este documento define as **decisões arquiteturais oficiais** do projeto Controle Clinic.  
Ele é a **fonte única de verdade** sobre autenticação, autorização, multiusuário e segurança.

⚠️ As regras aqui descritas **não são sugestões**.  
São **contratos arquiteturais obrigatórios**, para humanos e agentes de IA.

---

## Visão Geral

O Controle Clinic é um sistema **multi-tenant (multi-clínica)** construído com Supabase (Auth + Postgres + RLS) e front-end em React/Vite/TypeScript.

Cada usuário pode pertencer a uma ou mais clínicas, porém **só pode acessar dados das clínicas às quais está vinculado**.

---

## Regra de Ouro (NÃO NEGOCIÁVEL)

### Membership e autorização são EXCLUSIVAMENTE baseados em `user_id`

A associação usuário ↔ clínica ocorre **somente** por:
clinic_users.user_id → auth.users.id (auth.uid())
🚫 **E-mail NUNCA deve ser usado** para:
- autorização
- membership
- fallback de segurança
- definição de clínica
- checagem de permissões

Esta regra é definitiva.

---

## Modelo de Dados Essencial

### auth.users
- Fonte oficial de identidade
- `id (uuid)` é a chave única do usuário

### profiles
- Dados do usuário
- Pode conter `role` global e/ou `clinic_id` padrão

### clinic_users (tabela central do multiusuário)
Representa o vínculo usuário ↔ clínica.

Campos obrigatórios:
- `user_id` (uuid, FK auth.users.id)
- `clinic_id` (uuid)
- `role` (`owner | admin | user`)
- `ativo` (boolean)

📌 Nunca usar e-mail como chave de relacionamento.

---

## Resolução de Acesso no Front-end

- **Identidade:** `user.id` (Supabase Auth)
- **Clínica ativa:** último registro ativo em `clinic_users` para `auth.uid()`
- **Role (prioridade):**
profiles.role → clinic_users.role → “user”
---

## Funções SQL Oficiais (Contrato de Segurança)

Estas funções são usadas diretamente pelas policies de RLS e **não podem ter parâmetros renomeados**:

- `current_clinic_id()`
- `is_clinic_member(p_clinic_id uuid)`
- `is_clinic_admin(p_clinic_id uuid)`

---

## Row Level Security (RLS)

- Todas as tabelas sensíveis devem ter RLS ativo
- Toda policy deve validar:
  - `auth.uid()`
  - `clinic_id`
  - membership via funções oficiais

🚫 Policies genéricas (`using (true)`) são proibidas em produção.

---

## Front-end — Regras Obrigatórias

### Permitido
- Resolver membership por `user.id`
- Tipagem forte via `src/types/supabase.ts`
- Guards de rota por login e role

### Proibido
- Fallback por e-mail
- `as any` para contornar segurança
- Autorização apenas no front
- Duplicar regras sem RLS

---

## Integração com IA / Codex

Agentes de IA devem:
- Ler este documento antes de propor mudanças
- Preservar membership baseado em `user_id`
- Nunca sugerir fallback por e-mail
- Não enfraquecer RLS nem funções SQL existentes

Este documento governa decisões arquiteturais e de segurança do projeto.

---

## Fluxo de Alterações

- Mudou apenas o front → nenhum comando no Supabase
- Mudou o banco no Supabase → `db pull` + `gen types`
- Alteração estrutural → migration versionada + `db push`

---

## Resumo Executivo

- Controle Clinic é multi-tenant
- Segurança baseada em `auth.uid()`
- `clinic_users.user_id` é a chave do sistema
- E-mail nunca participa de autorização
- RLS é obrigatório
- Este documento é lei

---

## Runbook — Troca de Clínica (System Admin)

**Sintoma**
- `system_owner`/`super_admin` troca a clínica no seletor, mas a UI continua exibindo dados da clínica anterior (ex.: One Doctor).

**Causa**
- O RLS exige que `profiles.clinic_id` esteja alinhado com a clínica selecionada.
- O front-end mudou o estado local antes de persistir `profiles.clinic_id`, criando uma corrida: as queries rodavam antes do update no Supabase.

**Correção Padrão**
1. Atualizar `profiles.clinic_id` no Supabase ao trocar a clínica.
2. Só atualizar `selectedClinicId` e o estado local **após** o update confirmar.
3. Garantir que o carregamento da clínica use `effectiveClinicId`.

**Implementação de Referência**
- `src/auth/AuthProvider.tsx` — `setSelectedClinicId` aguarda update em `profiles`.
- `components/admin/ClinicSwitcher.tsx` — remove “Todas” e força clínica ativa.

**Notas**
- Este comportamento é obrigatório quando RLS restringe por clínica.
- Se voltar a ocorrer, revisar novamente o fluxo acima.

---

## Runbook — Pacotes de Páginas e System Admin

**Sintoma**
- `system_owner/super_admin` vê páginas que não fazem parte do pacote da clínica selecionada.

**Causa**
- `hasPageAccess` ignorava pacote para system admin, liberando tudo fora de `/admin`.

**Correção Padrão**
1. Manter acesso irrestrito somente em rotas `/admin`.
2. Para demais rotas, aplicar as mesmas regras de pacote usadas para usuários da clínica.

**Implementação de Referência**
- `src/auth/AuthProvider.tsx` → `hasPageAccess` agora valida pacote também para system admin.
