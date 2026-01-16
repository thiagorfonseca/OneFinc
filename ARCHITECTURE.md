# OneFinc — Arquitetura, Segurança e Multiusuário

Este documento define as **decisões arquiteturais oficiais** do projeto OneFinc.  
Ele é a **fonte única de verdade** sobre autenticação, autorização, multiusuário e segurança.

⚠️ As regras aqui descritas **não são sugestões**.  
São **contratos arquiteturais obrigatórios**, para humanos e agentes de IA.

---

## Visão Geral

O OneFinc é um sistema **multi-tenant (multi-clínica)** construído com Supabase (Auth + Postgres + RLS) e front-end em React/Vite/TypeScript.

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

- OneFinc é multi-tenant
- Segurança baseada em `auth.uid()`
- `clinic_users.user_id` é a chave do sistema
- E-mail nunca participa de autorização
- RLS é obrigatório
- Este documento é lei