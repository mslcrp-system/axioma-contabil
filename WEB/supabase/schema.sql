-- Schema for B2B Dashboard Taxonomy Mapper
-- All tables are prefixed with tctb1_ for isolation

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Clients Table
CREATE TABLE IF NOT EXISTS public.tctb1_clients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cnpj VARCHAR(18) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Buckets Table
-- macro_class maps to the 6 core structural components of the Dashboard Math Engine
CREATE TYPE tctb1_macro_class_enum AS ENUM (
    'Receita', 
    'Custo Variável', 
    'Despesa Fixa', 
    'Ativo Circulante', 
    'Passivo Circulante', 
    'Passivo Oneroso'
);

CREATE TABLE IF NOT EXISTS public.tctb1_buckets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID NOT NULL REFERENCES public.tctb1_clients(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    macro_class tctb1_macro_class_enum NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Mappings Table (The Core Brain)
-- Associates a raw string account_code from the ERP to a specific Bucket ID
CREATE TABLE IF NOT EXISTS public.tctb1_mappings (
    client_id UUID NOT NULL REFERENCES public.tctb1_clients(id) ON DELETE CASCADE,
    account_code VARCHAR(100) NOT NULL,
    bucket_id UUID NOT NULL REFERENCES public.tctb1_buckets(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (client_id, account_code)
);

-- 4. Competences Table
-- Isolates uploaded trial balances per month (e.g., '2026-03-01' for March 2026)
CREATE TABLE IF NOT EXISTS public.tctb1_competences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID NOT NULL REFERENCES public.tctb1_clients(id) ON DELETE CASCADE,
    reference_date DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (client_id, reference_date)
);

-- 5. Raw Balances Table (The Actual Money)
CREATE TYPE tctb1_nature_enum AS ENUM ('Devedor', 'Credor');

CREATE TABLE IF NOT EXISTS public.tctb1_raw_balances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    competence_id UUID NOT NULL REFERENCES public.tctb1_competences(id) ON DELETE CASCADE,
    account_code VARCHAR(100) NOT NULL,
    account_name VARCHAR(255) NOT NULL,
    balance NUMERIC(15,2) NOT NULL,
    nature tctb1_nature_enum NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS Security Policies Setup
ALTER TABLE public.tctb1_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tctb1_buckets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tctb1_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tctb1_competences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tctb1_raw_balances ENABLE ROW LEVEL SECURITY;

-- Development policy to allow anonymous/authenticated access for internal dashboard tool
CREATE POLICY "Enable read/write for all" ON public.tctb1_clients FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable read/write for all" ON public.tctb1_buckets FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable read/write for all" ON public.tctb1_mappings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable read/write for all" ON public.tctb1_competences FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable read/write for all" ON public.tctb1_raw_balances FOR ALL USING (true) WITH CHECK (true);
