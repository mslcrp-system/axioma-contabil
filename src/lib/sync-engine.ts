import { supabase } from './supabase';
import { RawAccount } from '../store/useMappingUIStore';

export interface SyncEngineResult {
  success: boolean;
  clientId?: string;
  mappedAccounts?: RawAccount[]; // Accounts that already have a bucket mapping
  orphanAccounts?: RawAccount[]; // Accounts that don't have a mapping yet
  bucketCounts?: Record<string, number>; // How many accounts fell into each bucket ID
  error?: string;
}

export const runAutoAllocationSync = async (
  cnpj: string, 
  referenceDate: string, 
  accounts: RawAccount[],
  onProgress?: (msg: string) => void
): Promise<SyncEngineResult> => {
  try {
    if (onProgress) onProgress('Buscando cliente...');
    
    // 1. Get or Create Client
    let { data: client, error: clientError } = await supabase
      .from('tctb1_clients')
      .select('id')
      .eq('cnpj', cnpj)
      .maybeSingle();

    if (clientError) { 
        throw new Error(`Erro ao buscar cliente: ${clientError.message}`);
    }

    if (!client) {
        if (onProgress) onProgress('Registrando novo cliente...');
        const { data: newClient, error: newClientError } = await supabase
            .from('tctb1_clients')
            .insert({ cnpj, name: `Empresa ${cnpj}` })
            .select('id')
            .single();
            
        if (newClientError) throw new Error(`Erro ao criar cliente: ${newClientError.message}`);
        client = newClient;
    }

    const clientId = client!.id;

    // 2. Destructive Upsert for Competence (Clear historical month data to avoid duplication)
    if (onProgress) onProgress('Limpando balancetes antigos desse mês (Destructive Upsert)...');
    
    const { data: existingComp } = await supabase
        .from('tctb1_competences')
        .select('id')
        .eq('client_id', clientId)
        .eq('reference_date', referenceDate)
        .single();
        
    if (existingComp) {
        // Because of ON DELETE CASCADE in schema, this will wipe all old tctb1_raw_balances automatically
        await supabase.from('tctb1_competences').delete().eq('id', existingComp.id);
    }

    const { data: newComp, error: compError } = await supabase
        .from('tctb1_competences')
        .insert({ client_id: clientId, reference_date: referenceDate })
        .select('id')
        .single();

    if (compError) throw new Error(`Erro ao criar competência: ${compError.message}`);
    const competenceId = newComp.id;

    // 3. Chunked Batch Insert (500 records per request to bypass Payload limits)
    const BATCH_SIZE = 500;
    const totalBatches = Math.ceil(accounts.length / BATCH_SIZE);
    
    for (let i = 0; i < accounts.length; i += BATCH_SIZE) {
        const batchNum = Math.floor(i / BATCH_SIZE) + 1;
        if (onProgress) onProgress(`Enviando Lote ${batchNum} de ${totalBatches}...`);

        const chunk = accounts.slice(i, i + BATCH_SIZE).map(acc => ({
            competence_id: competenceId,
            account_code: acc.account_code,
            account_name: acc.account_name,
            balance: acc.balance,
            debit: acc.debit_movement || 0,
            credit: acc.credit_movement || 0,
            nature: acc.nature
        }));

        const { error: batchError } = await supabase.from('tctb1_raw_balances').insert(chunk);
        
        // DEBUG LOG: Audit the payload being sent to Supabase
        console.log(`[Batch ${batchNum}] PAYLOAD ENVIADO:`, chunk.slice(0, 3).map(c => ({
            code: c.account_code,
            debit: c.debit,
            credit: c.credit
        })));

        if (batchError) throw new Error(`Erro no Batch Insert: ${batchError.message}`);
    }

    // 4. Look up historical Mappings for Auto-Allocation
    if (onProgress) onProgress('Cruzando histórico taxonômico...');
    const { data: mappings, error: mapError } = await supabase
        .from('tctb1_mappings')
        .select('account_code, bucket_id')
        .eq('client_id', clientId);

    if (mapError) throw new Error(`Erro ao buscar mapeamentos: ${mapError.message}`);

    // Create a Map of mapped account codes to bucket_id for O(1) lookup
    const codeToBucketId = new Map(mappings?.map(m => [m.account_code, m.bucket_id]) || []);

    const orphanAccounts: RawAccount[] = [];
    const mappedAccounts: RawAccount[] = [];
    const bucketCounts: Record<string, number> = {};

    for (const acc of accounts) {
        const bucketId = codeToBucketId.get(acc.account_code);
        if (bucketId) {
            mappedAccounts.push(acc);
            bucketCounts[bucketId] = (bucketCounts[bucketId] || 0) + 1;
        } else {
            orphanAccounts.push(acc);
        }
    }

    return {
        success: true,
        clientId,
        orphanAccounts,
        mappedAccounts,
        bucketCounts
    };

  } catch (err: any) {
    return {
        success: false,
        error: err.message || 'Erro crítico na engine de sincronismo.'
    };
  }
};

/**
 * Fetches all uploaded competences (months) for a specific client.
 */
export const fetchClientCompetences = async (clientId: string) => {
    const { data, error } = await supabase
        .from('tctb1_competences')
        .select('id, reference_date')
        .eq('client_id', clientId)
        .order('reference_date', { ascending: false });
    
    if (error) throw error;
    return data;
};

/**
 * Deletes a competence and all its associated balances (via CASCADE).
 */
export const deleteCompetence = async (competenceId: string) => {
    const { error } = await supabase.from('tctb1_competences').delete().eq('id', competenceId);
    if (error) throw error;
};

/**
 * Fetches historical balances and calculates mapping status for a specific competence.
 */
export const fetchBalancesForCompetence = async (
    clientId: string,
    competenceId: string
): Promise<SyncEngineResult> => {
    try {
        // 1. Fetch raw balances
        const { data: rawBalances, error: balError } = await supabase
            .from('tctb1_raw_balances')
            .select('account_code, account_name, balance, nature, debit, credit')
            .eq('competence_id', competenceId);
        
        if (balError) throw balError;

        // 2. Fetch mappings
        const { data: mappings, error: mapError } = await supabase
            .from('tctb1_mappings')
            .select('account_code, bucket_id')
            .eq('client_id', clientId);
        
        if (mapError) throw mapError;

        const codeToBucketId = new Map(mappings?.map(m => [m.account_code, m.bucket_id]) || []);
        const orphanAccounts: RawAccount[] = [];
        const mappedAccounts: RawAccount[] = [];
        const bucketCounts: Record<string, number> = {};

        for (const acc of (rawBalances as any[])) {
            const rawAcc: RawAccount = {
                account_code: acc.account_code,
                account_name: acc.account_name,
                balance: Number(acc.balance),
                debit_movement: Number(acc.debit || 0),
                credit_movement: Number(acc.credit || 0),
                nature: acc.nature
            };

            const bucketId = codeToBucketId.get(acc.account_code);
            if (bucketId) {
                mappedAccounts.push(rawAcc);
                bucketCounts[bucketId] = (bucketCounts[bucketId] || 0) + 1;
            } else {
                orphanAccounts.push(rawAcc);
            }
        }

        return {
            success: true,
            clientId,
            orphanAccounts,
            mappedAccounts,
            bucketCounts
        };
    } catch (err: any) {
        return { success: false, error: err.message };
    }
};

/**
 * Fetches and aggregates data for all months of a client for horizontal analysis.
 */
export const fetchHistoricalAggregatedData = async (
    clientId: string,
    buckets: { id: string, name: string, macro_class: any }[]
) => {
    try {
        const { data: competences, error: compError } = await supabase
            .from('tctb1_competences')
            .select('id, reference_date')
            .eq('client_id', clientId)
            .order('reference_date', { ascending: true });
        
        if (compError) throw compError;
        if (!competences || competences.length === 0) return [];

        const compIds = competences.map(c => c.id);
        const { data: allBalances, error: balError } = await supabase
            .from('tctb1_raw_balances')
            .select('competence_id, account_code, account_name, balance, nature, debit, credit')
            .in('competence_id', compIds);
        
        if (balError) throw balError;

        // DEBUG LOG: Audit the data coming from Supabase
        console.log("DADOS DO BANCO PARA DRE:", (allBalances as any[])?.map(d => ({ 
            acc: d.account_code, 
            debit: d.debit, 
            credit: d.credit 
        })));

        const { data: mappings } = await supabase
            .from('tctb1_mappings')
            .select('account_code, bucket_id')
            .eq('client_id', clientId);
        
        const codeToBucketId = new Map(mappings?.map(m => [m.account_code, m.bucket_id]) || []);

        // Group into drill-down data: Record<competence_id, Record<bucket_id, RawAccount[]>>
        const drillDown: Record<string, Record<string, RawAccount[]>> = {};
        
        for (const bal of allBalances) {
            const bucketId = codeToBucketId.get(bal.account_code);
            if (bucketId) {
                if (!drillDown[bal.competence_id]) drillDown[bal.competence_id] = {};
                if (!drillDown[bal.competence_id][bucketId]) drillDown[bal.competence_id][bucketId] = [];
                
                drillDown[bal.competence_id][bucketId].push({
                    account_code: bal.account_code,
                    account_name: bal.account_name,
                    balance: Number(bal.balance),
                    debit_movement: Number(bal.debit || 0),
                    credit_movement: Number(bal.credit || 0),
                    nature: bal.nature
                });
            }
        }

        const chartData = competences.map(comp => {
            const dateObj = new Date(comp.reference_date + 'T00:00:00');
            const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
            const monthLabel = `${months[dateObj.getMonth()]}/${dateObj.getFullYear().toString().slice(-2)}`;
            
            const row: any = { 
                month: monthLabel,
                rawDate: comp.reference_date,
                id: comp.id,
                drillDown: drillDown[comp.id] || {} // Include drill-down data for V2 engine
            };

            const macroTotals: Record<string, number> = {
                'Receita': 0,
                'Custo Variável': 0,
                'Despesa Fixa': 0,
                'Ativo Circulante': 0,
                'Passivo Circulante': 0,
                'Passivo Oneroso': 0
            };

            let clientesSum = 0;
            let fornecedoresSum = 0;

            buckets.forEach(b => {
                const accounts = (drillDown[comp.id] && drillDown[comp.id][b.id]) || [];
                
                let normalized = 0;
                const macroClassLower = (b.macro_class || '').toLowerCase();
                
                // NEW CONSOLIDATION RULES (V4 Architecture - Keyword Based Flex)
                if (macroClassLower.includes('receita')) {
                    // Rule 2: Revenue = sum(Credits) - sum(Debits)
                    normalized = accounts.reduce((sum, acc) => sum + (acc.credit_movement || 0) - (acc.debit_movement || 0), 0);
                } else if (macroClassLower.includes('custo') || macroClassLower.includes('despesa')) {
                    // Rule 3: Costs/Expenses = sum(Debits) - sum(Credits)
                    normalized = accounts.reduce((sum, acc) => sum + (acc.debit_movement || 0) - (acc.credit_movement || 0), 0);
                } else {
                    // Rule 1: Balance Sheet accounts keep using Saldo Final (applying inversion matrix)
                    const signedSum = accounts.reduce((sum, acc) => sum + acc.balance, 0);
                    const creditorBased = ['passivo circulante', 'passivo oneroso'];
                    normalized = creditorBased.includes(macroClassLower) ? signedSum * -1 : signedSum;
                }
                
                row[b.name] = normalized;

                if (macroTotals[b.macro_class] !== undefined) {
                    macroTotals[b.macro_class] += normalized;
                }

                // PILLAR 2: Granular Filtering by Name (Avoiding Tax Pollution)
                const nameLower = b.name.toLowerCase();
                if (nameLower.includes('cliente') || nameLower.includes('receber')) {
                    clientesSum += normalized;
                }
                if (nameLower.includes('fornecedor') || nameLower.includes('pagar')) {
                    fornecedoresSum += normalized;
                }
            });

            row['receita'] = macroTotals['Receita'] || 0;
            row['custo'] = macroTotals['Custo Variável'] || 0;
            row['desp_adm'] = macroTotals['Despesa Fixa'] || 0;
            row['clientes'] = clientesSum;
            row['fornecedores'] = fornecedoresSum;
            row['passivo_oneroso'] = macroTotals['Passivo Oneroso'] || 0;
            
            // Calculate Bottom Line (Resultado) using macro totals for safety
            row['resultado'] = row['receita'] - row['custo'] - row['desp_adm'];

            return row;
        });

        return chartData;

    } catch (err) {
        console.error("Historical Aggregation Error:", err);
        return [];
    }
};
