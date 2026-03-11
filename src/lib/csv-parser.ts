import Papa from 'papaparse';
import { RawAccount } from '../store/useMappingUIStore';

export interface CsvParseResult {
  success: boolean;
  cnpj?: string;
  referenceDate?: string;
  accounts?: RawAccount[];
  error?: string;
}

export const parseAndValidateCsv = (file: File): Promise<CsvParseResult> => {
  return new Promise((resolve) => {
    Papa.parse(file, {
      header: false,
      skipEmptyLines: true,
      complete: (results) => {
        try {
          const rows = results.data as string[][];
          
          if (rows.length < 7) {
            throw new Error('Arquivo de balancete muito curto ou sem cabeçalho padrão.');
          }

          // 1. Extração Dinâmica de Cabeçalho (Baseado no layout padrão do ERP)
          // Linha 1 (Zero-indexed): 2: "C.N.P.J.:", 3: "50.267.135/0001-96"
          const cnpjRow = rows.find(r => r.some(c => c?.includes('C.N.P.J.')));
          const cnpjRaw = cnpjRow ? cnpjRow.find(c => /\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/.test(c)) : null;
          if (!cnpjRaw) throw new Error('C.N.P.J. não encontrado no cabeçalho do balancete.');
          
          const cnpj = cnpjRaw.replace(/\D/g, ''); // Limpa pontuações

          // Linha 2 (Período)
          const dataRow = rows.find(r => r.some(c => c?.includes('Período:')));
          const dataStr = dataRow ? dataRow.find(c => /\d{2}\/\d{2}\/\d{4}.*\d{2}\/\d{2}\/\d{4}/.test(c)) : null;
          if (!dataStr) throw new Error('Data de competência não encontrada no balancete.');
          
          // Extraindo o mês/ano da data inicial. YYYY-MM-01 format.
          const matchDate = dataStr.match(/(\d{2})\/(\d{2})\/(\d{4})/);
          if (!matchDate) throw new Error('Formato de data inválido nas competências.');
          const referenceDate = `${matchDate[3]}-${matchDate[2]}-01`;

          // 2. Extração de Contas (Pulando cabeçalho de 7 linhas)
          const dataRows = rows.slice(7);
          const accounts: RawAccount[] = [];

          let totalDevedor = 0;
          let totalCredor = 0;

          dataRows.forEach((row, idx) => {
            const accCode = row[1]; // Coluna B: Classificação (ex: 1.1.20)
            const accName = row[3]; // Coluna D: Descrição (ex: CLIENTES)
            const balanceStr = row[11]; // Coluna L: Saldo Atual (ex: 460.003,48d)

            // Filtro de linhas vazias ou totais
            if (!accCode || accCode.trim() === '' || !balanceStr || balanceStr.trim() === '') return;

            // Limpeza e conversão monetária BR
            const cleanStr = balanceStr.replace(/\./g, '').replace(',', '.').toLowerCase();
            const valueMatch = cleanStr.match(/([\d\.]+)/);
            if (!valueMatch) return;

            const balanceRaw = parseFloat(valueMatch[1]);
            const isDevedor = cleanStr.endsWith('d');
            const nature = isDevedor ? 'Devedor' : 'Credor';
            
            // Signed balance: Debit is positive, Credit is negative
            const balance = isDevedor ? balanceRaw : -balanceRaw;

            if (isDevedor) totalDevedor += balanceRaw;
            else totalCredor += balanceRaw;

            accounts.push({
              account_code: accCode.trim(),
              account_name: accName.trim(),
              balance,
              nature
            });
          });

          // 3. Trava de Partida Dobrada Rigorosa
          const difference = Math.abs(totalDevedor - totalCredor);
          
          // Margem de erro por arredondamentos flutuantes em grandes balancetes (ex: 0.10 centavos)
          if (difference > 0.10) {
              const fTotalDev = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalDevedor);
              const fTotalCred = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalCredor);
              throw new Error(`Trava de Ingestão: O Balancete não fecha.\nTotal Devedor: ${fTotalDev}\nTotal Credor: ${fTotalCred}\nDiferença: ${difference.toFixed(2)}`);
          }

          resolve({
            success: true,
            cnpj,
            referenceDate,
            accounts
          });

        } catch (err: any) {
          resolve({
            success: false,
            error: err.message || 'Erro crítico ao processar CSV.'
          });
        }
      },
      error: (err) => {
        resolve({
          success: false,
          error: `Falha na leitura do arquivo: ${err.message}`
        });
      }
    });
  });
};
