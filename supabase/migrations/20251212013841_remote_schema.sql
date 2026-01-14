drop extension if exists "pg_net";

create extension if not exists "moddatetime" with schema "public";


  create table "public"."bank_accounts" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "clinic_id" uuid,
    "nome_conta" text not null,
    "banco" text not null,
    "initial_balance" numeric(14,2) default 0,
    "current_balance" numeric(14,2) default 0,
    "ativo" boolean default true,
    "created_at" timestamp with time zone default now()
      );


alter table "public"."bank_accounts" enable row level security;


  create table "public"."bank_transactions" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "bank_account_id" uuid,
    "data" date,
    "descricao" text,
    "valor" numeric(14,2),
    "tipo" text,
    "hash_transacao" text,
    "conciliado" boolean default false,
    "revenue_id_opcional" uuid,
    "expense_id_opcional" uuid,
    "created_at" timestamp with time zone default now()
      );


alter table "public"."bank_transactions" enable row level security;


  create table "public"."card_fees" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "clinic_id" uuid,
    "bandeira" text not null,
    "metodo" text not null default 'Cartão de Crédito'::text,
    "taxa_percent" numeric(6,3) not null default 0,
    "created_at" timestamp with time zone default now(),
    "min_installments" integer not null default 1,
    "max_installments" integer not null default 1
      );


alter table "public"."card_fees" enable row level security;


  create table "public"."categories" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "clinic_id" uuid,
    "name" text not null,
    "tipo" text not null,
    "cor_opcional" text,
    "created_at" timestamp with time zone default now()
      );


alter table "public"."categories" enable row level security;


  create table "public"."clinic_users" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "clinic_id" uuid,
    "name" text not null,
    "email" text not null,
    "role" text default 'user'::text,
    "ativo" boolean default true,
    "created_at" timestamp with time zone default now(),
    "paginas_liberadas" text[]
      );


alter table "public"."clinic_users" enable row level security;


  create table "public"."clinics" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "name" text not null,
    "created_at" timestamp with time zone default now(),
    "responsavel_nome" text,
    "documento" text,
    "email_contato" text,
    "telefone_contato" text,
    "plano" text default 'basico'::text,
    "paginas_liberadas" text[],
    "ativo" boolean default true
      );


alter table "public"."clinics" enable row level security;


  create table "public"."customers" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "clinic_id" uuid,
    "name" text not null,
    "cpf" text,
    "cep" text,
    "created_at" timestamp with time zone default now()
      );


alter table "public"."customers" enable row level security;


  create table "public"."expenses" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "clinic_id" uuid,
    "bank_account_id" uuid,
    "category_id" uuid,
    "description" text,
    "valor" numeric(14,2),
    "data_competencia" date,
    "data_pagamento" date,
    "fornecedor" text,
    "tipo_despesa" text,
    "observacoes" text,
    "status" text not null default 'paid'::text,
    "created_at" timestamp with time zone default now(),
    "forma_pagamento" text,
    "parcelas" integer default 1,
    "pessoa_tipo" text,
    "supplier_id" uuid
      );


alter table "public"."expenses" enable row level security;


  create table "public"."procedures" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "clinic_id" uuid,
    "categoria" text,
    "procedimento" text not null,
    "valor_cobrado" numeric(14,2),
    "custo_insumo" numeric(14,2),
    "tempo_minutos" integer,
    "created_at" timestamp with time zone default now()
      );


alter table "public"."procedures" enable row level security;


  create table "public"."professionals" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "clinic_id" uuid,
    "nome" text not null,
    "tipo" text not null,
    "created_at" timestamp with time zone default now()
      );


alter table "public"."professionals" enable row level security;


  create table "public"."profiles" (
    "id" uuid not null,
    "clinic_id" uuid,
    "full_name" text,
    "role" text default 'admin'::text,
    "created_at" timestamp with time zone default now()
      );


alter table "public"."profiles" enable row level security;


  create table "public"."revenue_procedures" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "revenue_id" uuid,
    "procedure_id" uuid,
    "categoria" text,
    "procedimento" text,
    "valor_cobrado" numeric(14,2),
    "quantidade" integer default 1,
    "created_at" timestamp with time zone default now(),
    "clinic_id" uuid default public.current_clinic_id()
      );


alter table "public"."revenue_procedures" enable row level security;


  create table "public"."revenues" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "clinic_id" uuid,
    "bank_account_id" uuid,
    "category_id" uuid,
    "description" text,
    "valor_bruto" numeric(14,2),
    "valor_liquido" numeric(14,2),
    "valor" numeric(14,2),
    "data_competencia" date,
    "data_recebimento" date,
    "paciente" text,
    "forma_pagamento" text,
    "observacoes" text,
    "status" text not null default 'paid'::text,
    "created_at" timestamp with time zone default now(),
    "parcelas" integer default 1,
    "forma_pagamento_taxa" numeric(6,3),
    "bandeira" text,
    "sale_professional_id" uuid,
    "exec_professional_id" uuid
      );


alter table "public"."revenues" enable row level security;


  create table "public"."suppliers" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "clinic_id" uuid,
    "nome" text not null,
    "cnpj" text,
    "telefone" text,
    "created_at" timestamp with time zone default now()
      );


alter table "public"."suppliers" enable row level security;

CREATE UNIQUE INDEX bank_accounts_pkey ON public.bank_accounts USING btree (id);

CREATE UNIQUE INDEX bank_transactions_hash_transacao_key ON public.bank_transactions USING btree (hash_transacao);

CREATE UNIQUE INDEX bank_transactions_pkey ON public.bank_transactions USING btree (id);

CREATE UNIQUE INDEX card_fees_pkey ON public.card_fees USING btree (id);

CREATE UNIQUE INDEX categories_pkey ON public.categories USING btree (id);

CREATE UNIQUE INDEX clinic_users_pkey ON public.clinic_users USING btree (id);

CREATE UNIQUE INDEX clinics_pkey ON public.clinics USING btree (id);

CREATE UNIQUE INDEX customers_pkey ON public.customers USING btree (id);

CREATE UNIQUE INDEX expenses_pkey ON public.expenses USING btree (id);

CREATE INDEX idx_revenue_procedures_clinic_id ON public.revenue_procedures USING btree (clinic_id);

CREATE UNIQUE INDEX procedures_pkey ON public.procedures USING btree (id);

CREATE UNIQUE INDEX professionals_pkey ON public.professionals USING btree (id);

CREATE UNIQUE INDEX profiles_pkey ON public.profiles USING btree (id);

CREATE UNIQUE INDEX revenues_pkey ON public.revenues USING btree (id);

CREATE UNIQUE INDEX suppliers_pkey ON public.suppliers USING btree (id);

alter table "public"."bank_accounts" add constraint "bank_accounts_pkey" PRIMARY KEY using index "bank_accounts_pkey";

alter table "public"."bank_transactions" add constraint "bank_transactions_pkey" PRIMARY KEY using index "bank_transactions_pkey";

alter table "public"."card_fees" add constraint "card_fees_pkey" PRIMARY KEY using index "card_fees_pkey";

alter table "public"."categories" add constraint "categories_pkey" PRIMARY KEY using index "categories_pkey";

alter table "public"."clinic_users" add constraint "clinic_users_pkey" PRIMARY KEY using index "clinic_users_pkey";

alter table "public"."clinics" add constraint "clinics_pkey" PRIMARY KEY using index "clinics_pkey";

alter table "public"."customers" add constraint "customers_pkey" PRIMARY KEY using index "customers_pkey";

alter table "public"."expenses" add constraint "expenses_pkey" PRIMARY KEY using index "expenses_pkey";

alter table "public"."procedures" add constraint "procedures_pkey" PRIMARY KEY using index "procedures_pkey";

alter table "public"."professionals" add constraint "professionals_pkey" PRIMARY KEY using index "professionals_pkey";

alter table "public"."profiles" add constraint "profiles_pkey" PRIMARY KEY using index "profiles_pkey";

alter table "public"."revenues" add constraint "revenues_pkey" PRIMARY KEY using index "revenues_pkey";

alter table "public"."suppliers" add constraint "suppliers_pkey" PRIMARY KEY using index "suppliers_pkey";

alter table "public"."bank_accounts" add constraint "bank_accounts_clinic_id_fkey" FOREIGN KEY (clinic_id) REFERENCES public.clinics(id) ON DELETE CASCADE not valid;

alter table "public"."bank_accounts" validate constraint "bank_accounts_clinic_id_fkey";

alter table "public"."bank_transactions" add constraint "bank_transactions_bank_account_id_fkey" FOREIGN KEY (bank_account_id) REFERENCES public.bank_accounts(id) ON DELETE CASCADE not valid;

alter table "public"."bank_transactions" validate constraint "bank_transactions_bank_account_id_fkey";

alter table "public"."bank_transactions" add constraint "bank_transactions_expense_id_opcional_fkey" FOREIGN KEY (expense_id_opcional) REFERENCES public.expenses(id) ON DELETE SET NULL not valid;

alter table "public"."bank_transactions" validate constraint "bank_transactions_expense_id_opcional_fkey";

alter table "public"."bank_transactions" add constraint "bank_transactions_hash_transacao_key" UNIQUE using index "bank_transactions_hash_transacao_key";

alter table "public"."bank_transactions" add constraint "bank_transactions_revenue_id_opcional_fkey" FOREIGN KEY (revenue_id_opcional) REFERENCES public.revenues(id) ON DELETE SET NULL not valid;

alter table "public"."bank_transactions" validate constraint "bank_transactions_revenue_id_opcional_fkey";

alter table "public"."card_fees" add constraint "card_fees_clinic_id_fkey" FOREIGN KEY (clinic_id) REFERENCES public.clinics(id) ON DELETE CASCADE not valid;

alter table "public"."card_fees" validate constraint "card_fees_clinic_id_fkey";

alter table "public"."categories" add constraint "categories_clinic_id_fkey" FOREIGN KEY (clinic_id) REFERENCES public.clinics(id) ON DELETE CASCADE not valid;

alter table "public"."categories" validate constraint "categories_clinic_id_fkey";

alter table "public"."categories" add constraint "categories_tipo_check" CHECK ((tipo = ANY (ARRAY['receita'::text, 'despesa'::text]))) not valid;

alter table "public"."categories" validate constraint "categories_tipo_check";

alter table "public"."clinic_users" add constraint "clinic_users_clinic_id_fkey" FOREIGN KEY (clinic_id) REFERENCES public.clinics(id) ON DELETE CASCADE not valid;

alter table "public"."clinic_users" validate constraint "clinic_users_clinic_id_fkey";

alter table "public"."customers" add constraint "customers_clinic_id_fkey" FOREIGN KEY (clinic_id) REFERENCES public.clinics(id) ON DELETE CASCADE not valid;

alter table "public"."customers" validate constraint "customers_clinic_id_fkey";

alter table "public"."expenses" add constraint "expenses_bank_account_id_fkey" FOREIGN KEY (bank_account_id) REFERENCES public.bank_accounts(id) ON DELETE SET NULL not valid;

alter table "public"."expenses" validate constraint "expenses_bank_account_id_fkey";

alter table "public"."expenses" add constraint "expenses_category_id_fkey" FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE SET NULL not valid;

alter table "public"."expenses" validate constraint "expenses_category_id_fkey";

alter table "public"."expenses" add constraint "expenses_clinic_id_fkey" FOREIGN KEY (clinic_id) REFERENCES public.clinics(id) ON DELETE CASCADE not valid;

alter table "public"."expenses" validate constraint "expenses_clinic_id_fkey";

alter table "public"."expenses" add constraint "expenses_status_check" CHECK ((status = ANY (ARRAY['paid'::text, 'pending'::text]))) not valid;

alter table "public"."expenses" validate constraint "expenses_status_check";

alter table "public"."expenses" add constraint "expenses_supplier_id_fkey" FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id) ON DELETE SET NULL not valid;

alter table "public"."expenses" validate constraint "expenses_supplier_id_fkey";

alter table "public"."procedures" add constraint "procedures_clinic_id_fkey" FOREIGN KEY (clinic_id) REFERENCES public.clinics(id) ON DELETE CASCADE not valid;

alter table "public"."procedures" validate constraint "procedures_clinic_id_fkey";

alter table "public"."professionals" add constraint "professionals_clinic_id_fkey" FOREIGN KEY (clinic_id) REFERENCES public.clinics(id) ON DELETE CASCADE not valid;

alter table "public"."professionals" validate constraint "professionals_clinic_id_fkey";

alter table "public"."professionals" add constraint "professionals_tipo_check" CHECK ((tipo = ANY (ARRAY['venda'::text, 'execucao'::text]))) not valid;

alter table "public"."professionals" validate constraint "professionals_tipo_check";

alter table "public"."profiles" add constraint "profiles_clinic_id_fkey" FOREIGN KEY (clinic_id) REFERENCES public.clinics(id) ON DELETE SET NULL not valid;

alter table "public"."profiles" validate constraint "profiles_clinic_id_fkey";

alter table "public"."profiles" add constraint "profiles_id_fkey" FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."profiles" validate constraint "profiles_id_fkey";

alter table "public"."revenue_procedures" add constraint "fk_revenue_procedures_clinic_id" FOREIGN KEY (clinic_id) REFERENCES public.clinics(id) ON DELETE RESTRICT not valid;

alter table "public"."revenue_procedures" validate constraint "fk_revenue_procedures_clinic_id";

alter table "public"."revenue_procedures" add constraint "revenue_procedures_procedure_id_fkey" FOREIGN KEY (procedure_id) REFERENCES public.procedures(id) ON DELETE SET NULL not valid;

alter table "public"."revenue_procedures" validate constraint "revenue_procedures_procedure_id_fkey";

alter table "public"."revenue_procedures" add constraint "revenue_procedures_revenue_id_fkey" FOREIGN KEY (revenue_id) REFERENCES public.revenues(id) ON DELETE CASCADE not valid;

alter table "public"."revenue_procedures" validate constraint "revenue_procedures_revenue_id_fkey";

alter table "public"."revenues" add constraint "revenues_bank_account_id_fkey" FOREIGN KEY (bank_account_id) REFERENCES public.bank_accounts(id) ON DELETE SET NULL not valid;

alter table "public"."revenues" validate constraint "revenues_bank_account_id_fkey";

alter table "public"."revenues" add constraint "revenues_category_id_fkey" FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE SET NULL not valid;

alter table "public"."revenues" validate constraint "revenues_category_id_fkey";

alter table "public"."revenues" add constraint "revenues_clinic_id_fkey" FOREIGN KEY (clinic_id) REFERENCES public.clinics(id) ON DELETE CASCADE not valid;

alter table "public"."revenues" validate constraint "revenues_clinic_id_fkey";

alter table "public"."revenues" add constraint "revenues_exec_professional_id_fkey" FOREIGN KEY (exec_professional_id) REFERENCES public.professionals(id) ON DELETE SET NULL not valid;

alter table "public"."revenues" validate constraint "revenues_exec_professional_id_fkey";

alter table "public"."revenues" add constraint "revenues_sale_professional_id_fkey" FOREIGN KEY (sale_professional_id) REFERENCES public.professionals(id) ON DELETE SET NULL not valid;

alter table "public"."revenues" validate constraint "revenues_sale_professional_id_fkey";

alter table "public"."revenues" add constraint "revenues_status_check" CHECK ((status = ANY (ARRAY['paid'::text, 'pending'::text]))) not valid;

alter table "public"."revenues" validate constraint "revenues_status_check";

alter table "public"."suppliers" add constraint "suppliers_clinic_id_fkey" FOREIGN KEY (clinic_id) REFERENCES public.clinics(id) ON DELETE CASCADE not valid;

alter table "public"."suppliers" validate constraint "suppliers_clinic_id_fkey";

set check_function_bodies = off;

create or replace view "public"."app_current_user" as  SELECT id AS user_id,
    clinic_id,
    role
   FROM public.profiles p
  WHERE (id = auth.uid());


CREATE OR REPLACE FUNCTION public.current_clinic_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE
AS $function$
  SELECT NULL::uuid;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.is_clinic_member(p_clinic_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
AS $function$
  SELECT false;
$function$
;

grant delete on table "public"."bank_accounts" to "anon";

grant insert on table "public"."bank_accounts" to "anon";

grant references on table "public"."bank_accounts" to "anon";

grant select on table "public"."bank_accounts" to "anon";

grant trigger on table "public"."bank_accounts" to "anon";

grant truncate on table "public"."bank_accounts" to "anon";

grant update on table "public"."bank_accounts" to "anon";

grant delete on table "public"."bank_accounts" to "authenticated";

grant insert on table "public"."bank_accounts" to "authenticated";

grant references on table "public"."bank_accounts" to "authenticated";

grant select on table "public"."bank_accounts" to "authenticated";

grant trigger on table "public"."bank_accounts" to "authenticated";

grant truncate on table "public"."bank_accounts" to "authenticated";

grant update on table "public"."bank_accounts" to "authenticated";

grant delete on table "public"."bank_accounts" to "service_role";

grant insert on table "public"."bank_accounts" to "service_role";

grant references on table "public"."bank_accounts" to "service_role";

grant select on table "public"."bank_accounts" to "service_role";

grant trigger on table "public"."bank_accounts" to "service_role";

grant truncate on table "public"."bank_accounts" to "service_role";

grant update on table "public"."bank_accounts" to "service_role";

grant delete on table "public"."bank_transactions" to "anon";

grant insert on table "public"."bank_transactions" to "anon";

grant references on table "public"."bank_transactions" to "anon";

grant select on table "public"."bank_transactions" to "anon";

grant trigger on table "public"."bank_transactions" to "anon";

grant truncate on table "public"."bank_transactions" to "anon";

grant update on table "public"."bank_transactions" to "anon";

grant delete on table "public"."bank_transactions" to "authenticated";

grant insert on table "public"."bank_transactions" to "authenticated";

grant references on table "public"."bank_transactions" to "authenticated";

grant select on table "public"."bank_transactions" to "authenticated";

grant trigger on table "public"."bank_transactions" to "authenticated";

grant truncate on table "public"."bank_transactions" to "authenticated";

grant update on table "public"."bank_transactions" to "authenticated";

grant delete on table "public"."bank_transactions" to "service_role";

grant insert on table "public"."bank_transactions" to "service_role";

grant references on table "public"."bank_transactions" to "service_role";

grant select on table "public"."bank_transactions" to "service_role";

grant trigger on table "public"."bank_transactions" to "service_role";

grant truncate on table "public"."bank_transactions" to "service_role";

grant update on table "public"."bank_transactions" to "service_role";

grant delete on table "public"."card_fees" to "anon";

grant insert on table "public"."card_fees" to "anon";

grant references on table "public"."card_fees" to "anon";

grant select on table "public"."card_fees" to "anon";

grant trigger on table "public"."card_fees" to "anon";

grant truncate on table "public"."card_fees" to "anon";

grant update on table "public"."card_fees" to "anon";

grant delete on table "public"."card_fees" to "authenticated";

grant insert on table "public"."card_fees" to "authenticated";

grant references on table "public"."card_fees" to "authenticated";

grant select on table "public"."card_fees" to "authenticated";

grant trigger on table "public"."card_fees" to "authenticated";

grant truncate on table "public"."card_fees" to "authenticated";

grant update on table "public"."card_fees" to "authenticated";

grant delete on table "public"."card_fees" to "service_role";

grant insert on table "public"."card_fees" to "service_role";

grant references on table "public"."card_fees" to "service_role";

grant select on table "public"."card_fees" to "service_role";

grant trigger on table "public"."card_fees" to "service_role";

grant truncate on table "public"."card_fees" to "service_role";

grant update on table "public"."card_fees" to "service_role";

grant delete on table "public"."categories" to "anon";

grant insert on table "public"."categories" to "anon";

grant references on table "public"."categories" to "anon";

grant select on table "public"."categories" to "anon";

grant trigger on table "public"."categories" to "anon";

grant truncate on table "public"."categories" to "anon";

grant update on table "public"."categories" to "anon";

grant delete on table "public"."categories" to "authenticated";

grant insert on table "public"."categories" to "authenticated";

grant references on table "public"."categories" to "authenticated";

grant select on table "public"."categories" to "authenticated";

grant trigger on table "public"."categories" to "authenticated";

grant truncate on table "public"."categories" to "authenticated";

grant update on table "public"."categories" to "authenticated";

grant delete on table "public"."categories" to "service_role";

grant insert on table "public"."categories" to "service_role";

grant references on table "public"."categories" to "service_role";

grant select on table "public"."categories" to "service_role";

grant trigger on table "public"."categories" to "service_role";

grant truncate on table "public"."categories" to "service_role";

grant update on table "public"."categories" to "service_role";

grant delete on table "public"."clinic_users" to "anon";

grant insert on table "public"."clinic_users" to "anon";

grant references on table "public"."clinic_users" to "anon";

grant select on table "public"."clinic_users" to "anon";

grant trigger on table "public"."clinic_users" to "anon";

grant truncate on table "public"."clinic_users" to "anon";

grant update on table "public"."clinic_users" to "anon";

grant delete on table "public"."clinic_users" to "authenticated";

grant insert on table "public"."clinic_users" to "authenticated";

grant references on table "public"."clinic_users" to "authenticated";

grant select on table "public"."clinic_users" to "authenticated";

grant trigger on table "public"."clinic_users" to "authenticated";

grant truncate on table "public"."clinic_users" to "authenticated";

grant update on table "public"."clinic_users" to "authenticated";

grant delete on table "public"."clinic_users" to "service_role";

grant insert on table "public"."clinic_users" to "service_role";

grant references on table "public"."clinic_users" to "service_role";

grant select on table "public"."clinic_users" to "service_role";

grant trigger on table "public"."clinic_users" to "service_role";

grant truncate on table "public"."clinic_users" to "service_role";

grant update on table "public"."clinic_users" to "service_role";

grant delete on table "public"."clinics" to "anon";

grant insert on table "public"."clinics" to "anon";

grant references on table "public"."clinics" to "anon";

grant select on table "public"."clinics" to "anon";

grant trigger on table "public"."clinics" to "anon";

grant truncate on table "public"."clinics" to "anon";

grant update on table "public"."clinics" to "anon";

grant delete on table "public"."clinics" to "authenticated";

grant insert on table "public"."clinics" to "authenticated";

grant references on table "public"."clinics" to "authenticated";

grant select on table "public"."clinics" to "authenticated";

grant trigger on table "public"."clinics" to "authenticated";

grant truncate on table "public"."clinics" to "authenticated";

grant update on table "public"."clinics" to "authenticated";

grant delete on table "public"."clinics" to "service_role";

grant insert on table "public"."clinics" to "service_role";

grant references on table "public"."clinics" to "service_role";

grant select on table "public"."clinics" to "service_role";

grant trigger on table "public"."clinics" to "service_role";

grant truncate on table "public"."clinics" to "service_role";

grant update on table "public"."clinics" to "service_role";

grant delete on table "public"."customers" to "anon";

grant insert on table "public"."customers" to "anon";

grant references on table "public"."customers" to "anon";

grant select on table "public"."customers" to "anon";

grant trigger on table "public"."customers" to "anon";

grant truncate on table "public"."customers" to "anon";

grant update on table "public"."customers" to "anon";

grant delete on table "public"."customers" to "authenticated";

grant insert on table "public"."customers" to "authenticated";

grant references on table "public"."customers" to "authenticated";

grant select on table "public"."customers" to "authenticated";

grant trigger on table "public"."customers" to "authenticated";

grant truncate on table "public"."customers" to "authenticated";

grant update on table "public"."customers" to "authenticated";

grant delete on table "public"."customers" to "service_role";

grant insert on table "public"."customers" to "service_role";

grant references on table "public"."customers" to "service_role";

grant select on table "public"."customers" to "service_role";

grant trigger on table "public"."customers" to "service_role";

grant truncate on table "public"."customers" to "service_role";

grant update on table "public"."customers" to "service_role";

grant delete on table "public"."expenses" to "anon";

grant insert on table "public"."expenses" to "anon";

grant references on table "public"."expenses" to "anon";

grant select on table "public"."expenses" to "anon";

grant trigger on table "public"."expenses" to "anon";

grant truncate on table "public"."expenses" to "anon";

grant update on table "public"."expenses" to "anon";

grant delete on table "public"."expenses" to "authenticated";

grant insert on table "public"."expenses" to "authenticated";

grant references on table "public"."expenses" to "authenticated";

grant select on table "public"."expenses" to "authenticated";

grant trigger on table "public"."expenses" to "authenticated";

grant truncate on table "public"."expenses" to "authenticated";

grant update on table "public"."expenses" to "authenticated";

grant delete on table "public"."expenses" to "service_role";

grant insert on table "public"."expenses" to "service_role";

grant references on table "public"."expenses" to "service_role";

grant select on table "public"."expenses" to "service_role";

grant trigger on table "public"."expenses" to "service_role";

grant truncate on table "public"."expenses" to "service_role";

grant update on table "public"."expenses" to "service_role";

grant delete on table "public"."procedures" to "anon";

grant insert on table "public"."procedures" to "anon";

grant references on table "public"."procedures" to "anon";

grant select on table "public"."procedures" to "anon";

grant trigger on table "public"."procedures" to "anon";

grant truncate on table "public"."procedures" to "anon";

grant update on table "public"."procedures" to "anon";

grant delete on table "public"."procedures" to "authenticated";

grant insert on table "public"."procedures" to "authenticated";

grant references on table "public"."procedures" to "authenticated";

grant select on table "public"."procedures" to "authenticated";

grant trigger on table "public"."procedures" to "authenticated";

grant truncate on table "public"."procedures" to "authenticated";

grant update on table "public"."procedures" to "authenticated";

grant delete on table "public"."procedures" to "service_role";

grant insert on table "public"."procedures" to "service_role";

grant references on table "public"."procedures" to "service_role";

grant select on table "public"."procedures" to "service_role";

grant trigger on table "public"."procedures" to "service_role";

grant truncate on table "public"."procedures" to "service_role";

grant update on table "public"."procedures" to "service_role";

grant delete on table "public"."professionals" to "anon";

grant insert on table "public"."professionals" to "anon";

grant references on table "public"."professionals" to "anon";

grant select on table "public"."professionals" to "anon";

grant trigger on table "public"."professionals" to "anon";

grant truncate on table "public"."professionals" to "anon";

grant update on table "public"."professionals" to "anon";

grant delete on table "public"."professionals" to "authenticated";

grant insert on table "public"."professionals" to "authenticated";

grant references on table "public"."professionals" to "authenticated";

grant select on table "public"."professionals" to "authenticated";

grant trigger on table "public"."professionals" to "authenticated";

grant truncate on table "public"."professionals" to "authenticated";

grant update on table "public"."professionals" to "authenticated";

grant delete on table "public"."professionals" to "service_role";

grant insert on table "public"."professionals" to "service_role";

grant references on table "public"."professionals" to "service_role";

grant select on table "public"."professionals" to "service_role";

grant trigger on table "public"."professionals" to "service_role";

grant truncate on table "public"."professionals" to "service_role";

grant update on table "public"."professionals" to "service_role";

grant delete on table "public"."profiles" to "anon";

grant insert on table "public"."profiles" to "anon";

grant references on table "public"."profiles" to "anon";

grant select on table "public"."profiles" to "anon";

grant trigger on table "public"."profiles" to "anon";

grant truncate on table "public"."profiles" to "anon";

grant update on table "public"."profiles" to "anon";

grant delete on table "public"."profiles" to "authenticated";

grant insert on table "public"."profiles" to "authenticated";

grant references on table "public"."profiles" to "authenticated";

grant select on table "public"."profiles" to "authenticated";

grant trigger on table "public"."profiles" to "authenticated";

grant truncate on table "public"."profiles" to "authenticated";

grant update on table "public"."profiles" to "authenticated";

grant delete on table "public"."profiles" to "service_role";

grant insert on table "public"."profiles" to "service_role";

grant references on table "public"."profiles" to "service_role";

grant select on table "public"."profiles" to "service_role";

grant trigger on table "public"."profiles" to "service_role";

grant truncate on table "public"."profiles" to "service_role";

grant update on table "public"."profiles" to "service_role";

grant delete on table "public"."revenue_procedures" to "anon";

grant insert on table "public"."revenue_procedures" to "anon";

grant references on table "public"."revenue_procedures" to "anon";

grant select on table "public"."revenue_procedures" to "anon";

grant trigger on table "public"."revenue_procedures" to "anon";

grant truncate on table "public"."revenue_procedures" to "anon";

grant update on table "public"."revenue_procedures" to "anon";

grant delete on table "public"."revenue_procedures" to "authenticated";

grant insert on table "public"."revenue_procedures" to "authenticated";

grant references on table "public"."revenue_procedures" to "authenticated";

grant select on table "public"."revenue_procedures" to "authenticated";

grant trigger on table "public"."revenue_procedures" to "authenticated";

grant truncate on table "public"."revenue_procedures" to "authenticated";

grant update on table "public"."revenue_procedures" to "authenticated";

grant delete on table "public"."revenue_procedures" to "service_role";

grant insert on table "public"."revenue_procedures" to "service_role";

grant references on table "public"."revenue_procedures" to "service_role";

grant select on table "public"."revenue_procedures" to "service_role";

grant trigger on table "public"."revenue_procedures" to "service_role";

grant truncate on table "public"."revenue_procedures" to "service_role";

grant update on table "public"."revenue_procedures" to "service_role";

grant delete on table "public"."revenues" to "anon";

grant insert on table "public"."revenues" to "anon";

grant references on table "public"."revenues" to "anon";

grant select on table "public"."revenues" to "anon";

grant trigger on table "public"."revenues" to "anon";

grant truncate on table "public"."revenues" to "anon";

grant update on table "public"."revenues" to "anon";

grant delete on table "public"."revenues" to "authenticated";

grant insert on table "public"."revenues" to "authenticated";

grant references on table "public"."revenues" to "authenticated";

grant select on table "public"."revenues" to "authenticated";

grant trigger on table "public"."revenues" to "authenticated";

grant truncate on table "public"."revenues" to "authenticated";

grant update on table "public"."revenues" to "authenticated";

grant delete on table "public"."revenues" to "service_role";

grant insert on table "public"."revenues" to "service_role";

grant references on table "public"."revenues" to "service_role";

grant select on table "public"."revenues" to "service_role";

grant trigger on table "public"."revenues" to "service_role";

grant truncate on table "public"."revenues" to "service_role";

grant update on table "public"."revenues" to "service_role";

grant delete on table "public"."suppliers" to "anon";

grant insert on table "public"."suppliers" to "anon";

grant references on table "public"."suppliers" to "anon";

grant select on table "public"."suppliers" to "anon";

grant trigger on table "public"."suppliers" to "anon";

grant truncate on table "public"."suppliers" to "anon";

grant update on table "public"."suppliers" to "anon";

grant delete on table "public"."suppliers" to "authenticated";

grant insert on table "public"."suppliers" to "authenticated";

grant references on table "public"."suppliers" to "authenticated";

grant select on table "public"."suppliers" to "authenticated";

grant trigger on table "public"."suppliers" to "authenticated";

grant truncate on table "public"."suppliers" to "authenticated";

grant update on table "public"."suppliers" to "authenticated";

grant delete on table "public"."suppliers" to "service_role";

grant insert on table "public"."suppliers" to "service_role";

grant references on table "public"."suppliers" to "service_role";

grant select on table "public"."suppliers" to "service_role";

grant trigger on table "public"."suppliers" to "service_role";

grant truncate on table "public"."suppliers" to "service_role";

grant update on table "public"."suppliers" to "service_role";


  create policy "Authenticated access"
  on "public"."bank_accounts"
  as permissive
  for all
  to authenticated
using (true)
with check (true);



  create policy "bank_accounts_delete"
  on "public"."bank_accounts"
  as permissive
  for delete
  to public
using ((EXISTS ( SELECT 1
   FROM public.app_current_user cu
  WHERE ((cu.clinic_id = bank_accounts.clinic_id) AND (cu.role = 'admin'::text)))));



  create policy "bank_accounts_insert"
  on "public"."bank_accounts"
  as permissive
  for insert
  to public
with check ((EXISTS ( SELECT 1
   FROM public.app_current_user cu
  WHERE ((cu.clinic_id = bank_accounts.clinic_id) AND (cu.role = ANY (ARRAY['admin'::text, 'financeiro'::text]))))));



  create policy "bank_accounts_select"
  on "public"."bank_accounts"
  as permissive
  for select
  to public
using ((EXISTS ( SELECT 1
   FROM public.app_current_user cu
  WHERE ((cu.clinic_id = bank_accounts.clinic_id) AND (cu.role = ANY (ARRAY['admin'::text, 'financeiro'::text, 'view_only'::text]))))));



  create policy "bank_accounts_update"
  on "public"."bank_accounts"
  as permissive
  for update
  to public
using ((EXISTS ( SELECT 1
   FROM public.app_current_user cu
  WHERE ((cu.clinic_id = bank_accounts.clinic_id) AND (cu.role = ANY (ARRAY['admin'::text, 'financeiro'::text]))))));



  create policy "Authenticated access"
  on "public"."bank_transactions"
  as permissive
  for all
  to authenticated
using (true)
with check (true);



  create policy "bank_transactions_delete"
  on "public"."bank_transactions"
  as permissive
  for delete
  to public
using ((EXISTS ( SELECT 1
   FROM (public.app_current_user cu
     JOIN public.bank_accounts ba ON ((ba.id = bank_transactions.bank_account_id)))
  WHERE ((ba.clinic_id = cu.clinic_id) AND (cu.role = 'admin'::text)))));



  create policy "bank_transactions_insert"
  on "public"."bank_transactions"
  as permissive
  for insert
  to public
with check ((EXISTS ( SELECT 1
   FROM (public.app_current_user cu
     JOIN public.bank_accounts ba ON ((ba.id = bank_transactions.bank_account_id)))
  WHERE ((ba.clinic_id = cu.clinic_id) AND (cu.role = ANY (ARRAY['admin'::text, 'financeiro'::text]))))));



  create policy "bank_transactions_select"
  on "public"."bank_transactions"
  as permissive
  for select
  to public
using ((EXISTS ( SELECT 1
   FROM (public.app_current_user cu
     JOIN public.bank_accounts ba ON ((ba.id = bank_transactions.bank_account_id)))
  WHERE ((ba.clinic_id = cu.clinic_id) AND (cu.role = ANY (ARRAY['admin'::text, 'financeiro'::text, 'view_only'::text]))))));



  create policy "bank_transactions_update"
  on "public"."bank_transactions"
  as permissive
  for update
  to public
using ((EXISTS ( SELECT 1
   FROM (public.app_current_user cu
     JOIN public.bank_accounts ba ON ((ba.id = bank_transactions.bank_account_id)))
  WHERE ((ba.clinic_id = cu.clinic_id) AND (cu.role = ANY (ARRAY['admin'::text, 'financeiro'::text]))))));



  create policy "Authenticated access"
  on "public"."card_fees"
  as permissive
  for all
  to authenticated
using (true)
with check (true);



  create policy "Authenticated access"
  on "public"."categories"
  as permissive
  for all
  to authenticated
using (true)
with check (true);



  create policy "Authenticated access"
  on "public"."clinic_users"
  as permissive
  for all
  to authenticated
using (true)
with check (true);



  create policy "Authenticated access"
  on "public"."clinics"
  as permissive
  for all
  to authenticated
using (true)
with check (true);



  create policy "clinics_delete"
  on "public"."clinics"
  as permissive
  for delete
  to public
using ((EXISTS ( SELECT 1
   FROM public.app_current_user cu
  WHERE ((cu.clinic_id = clinics.id) AND (cu.role = 'admin'::text)))));



  create policy "clinics_insert"
  on "public"."clinics"
  as permissive
  for insert
  to public
with check ((EXISTS ( SELECT 1
   FROM public.app_current_user cu
  WHERE (cu.role = 'admin'::text))));



  create policy "clinics_select"
  on "public"."clinics"
  as permissive
  for select
  to public
using ((EXISTS ( SELECT 1
   FROM public.app_current_user cu
  WHERE ((cu.clinic_id = clinics.id) AND (cu.role = ANY (ARRAY['admin'::text, 'financeiro'::text, 'view_only'::text]))))));



  create policy "clinics_update"
  on "public"."clinics"
  as permissive
  for update
  to public
using ((EXISTS ( SELECT 1
   FROM public.app_current_user cu
  WHERE ((cu.clinic_id = clinics.id) AND (cu.role = 'admin'::text)))));



  create policy "Authenticated access"
  on "public"."customers"
  as permissive
  for all
  to authenticated
using (true)
with check (true);



  create policy "Authenticated access"
  on "public"."expenses"
  as permissive
  for all
  to authenticated
using (true)
with check (true);



  create policy "expenses_delete"
  on "public"."expenses"
  as permissive
  for delete
  to public
using ((EXISTS ( SELECT 1
   FROM public.app_current_user cu
  WHERE ((cu.clinic_id = expenses.clinic_id) AND (cu.role = 'admin'::text)))));



  create policy "expenses_insert"
  on "public"."expenses"
  as permissive
  for insert
  to public
with check ((EXISTS ( SELECT 1
   FROM public.app_current_user cu
  WHERE ((cu.clinic_id = expenses.clinic_id) AND (cu.role = ANY (ARRAY['admin'::text, 'financeiro'::text]))))));



  create policy "expenses_select"
  on "public"."expenses"
  as permissive
  for select
  to public
using ((EXISTS ( SELECT 1
   FROM public.app_current_user cu
  WHERE ((cu.clinic_id = expenses.clinic_id) AND (cu.role = ANY (ARRAY['admin'::text, 'financeiro'::text, 'view_only'::text]))))));



  create policy "expenses_update"
  on "public"."expenses"
  as permissive
  for update
  to public
using ((EXISTS ( SELECT 1
   FROM public.app_current_user cu
  WHERE ((cu.clinic_id = expenses.clinic_id) AND (cu.role = ANY (ARRAY['admin'::text, 'financeiro'::text]))))));



  create policy "Authenticated access"
  on "public"."procedures"
  as permissive
  for all
  to authenticated
using (true)
with check (true);



  create policy "Authenticated access"
  on "public"."professionals"
  as permissive
  for all
  to authenticated
using (true)
with check (true);



  create policy "Insert own profile"
  on "public"."profiles"
  as permissive
  for insert
  to authenticated
with check ((auth.uid() = id));



  create policy "Own profile"
  on "public"."profiles"
  as permissive
  for select
  to authenticated
using ((auth.uid() = id));



  create policy "Update own profile"
  on "public"."profiles"
  as permissive
  for update
  to authenticated
using ((auth.uid() = id));



  create policy "profiles_delete"
  on "public"."profiles"
  as permissive
  for delete
  to public
using ((EXISTS ( SELECT 1
   FROM public.app_current_user cu
  WHERE ((cu.role = 'admin'::text) AND (cu.clinic_id = profiles.clinic_id)))));



  create policy "profiles_insert"
  on "public"."profiles"
  as permissive
  for insert
  to public
with check ((EXISTS ( SELECT 1
   FROM public.app_current_user cu
  WHERE ((cu.role = 'admin'::text) AND (cu.clinic_id = profiles.clinic_id)))));



  create policy "profiles_select"
  on "public"."profiles"
  as permissive
  for select
  to public
using ((EXISTS ( SELECT 1
   FROM public.app_current_user cu
  WHERE ((cu.clinic_id = profiles.clinic_id) AND (cu.role = ANY (ARRAY['admin'::text, 'financeiro'::text, 'view_only'::text]))))));



  create policy "profiles_update"
  on "public"."profiles"
  as permissive
  for update
  to public
using ((EXISTS ( SELECT 1
   FROM public.app_current_user cu
  WHERE ((cu.role = 'admin'::text) AND (cu.clinic_id = profiles.clinic_id)))));



  create policy "Authenticated access"
  on "public"."revenue_procedures"
  as permissive
  for all
  to authenticated
using (true)
with check (true);



  create policy "revenue_procedures_all"
  on "public"."revenue_procedures"
  as permissive
  for all
  to public
using (public.is_clinic_member(clinic_id))
with check (public.is_clinic_member(clinic_id));



  create policy "revenue_procedures_sel"
  on "public"."revenue_procedures"
  as permissive
  for select
  to public
using (public.is_clinic_member(clinic_id));



  create policy "Authenticated access"
  on "public"."revenues"
  as permissive
  for all
  to authenticated
using (true)
with check (true);



  create policy "revenues_delete"
  on "public"."revenues"
  as permissive
  for delete
  to public
using ((EXISTS ( SELECT 1
   FROM public.app_current_user cu
  WHERE ((cu.clinic_id = revenues.clinic_id) AND (cu.role = 'admin'::text)))));



  create policy "revenues_insert"
  on "public"."revenues"
  as permissive
  for insert
  to public
with check ((EXISTS ( SELECT 1
   FROM public.app_current_user cu
  WHERE ((cu.clinic_id = revenues.clinic_id) AND (cu.role = ANY (ARRAY['admin'::text, 'financeiro'::text]))))));



  create policy "revenues_select"
  on "public"."revenues"
  as permissive
  for select
  to public
using ((EXISTS ( SELECT 1
   FROM public.app_current_user cu
  WHERE ((cu.clinic_id = revenues.clinic_id) AND (cu.role = ANY (ARRAY['admin'::text, 'financeiro'::text, 'view_only'::text]))))));



  create policy "revenues_update"
  on "public"."revenues"
  as permissive
  for update
  to public
using ((EXISTS ( SELECT 1
   FROM public.app_current_user cu
  WHERE ((cu.clinic_id = revenues.clinic_id) AND (cu.role = ANY (ARRAY['admin'::text, 'financeiro'::text]))))));



  create policy "Authenticated access"
  on "public"."suppliers"
  as permissive
  for all
  to authenticated
using (true)
with check (true);



