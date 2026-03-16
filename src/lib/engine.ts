import { MacroClass } from '../components/BucketManager';

export interface AggregatedResult {
  bucketId: string;
  bucketName: string;
  macroClass: MacroClass;
  totalBalance: number;
}

/**
 * Normalizes account balances based on their Macro-Class.
 * 
 * Logic:
 * - Creditors (Revenue, Liabilities) are positive by default.
 * - Debtors (Costs, Assets) are positive by default.
 * - If an account of opposing nature falls into a bucket, it subtracts (inversion).
 * 
 * Implementation:
 * We use the signed balance from the DB (Debit is positive, Credit is negative).
 * 
 * - Macro Classes Creditor-based: [Receita, Passivo Circulante, Passivo Oneroso]
 *   Final = Sum(balances) * -1
 * 
 * - Macro Classes Debtor-based: [Custo Variável, Despesa Fixa, Ativo Circulante]
 *   Final = Sum(balances) * 1
 */
export const calculateNormalizedBalance = (
  macroClass: MacroClass, 
  signedBalance: number
): number => {
  const creditorBased = ['receita', 'passivo circulante', 'passivo oneroso'];
  const macroLower = (macroClass || '').toLowerCase();
  
  if (creditorBased.includes(macroLower)) {
    return signedBalance * -1;
  }
  
  return signedBalance;
};

export const aggregateBalancesByBucket = (
  buckets: { id: string, name: string, macro_class: MacroClass }[],
  rawBalances: { account_code: string, balance: number }[],
  mappings: { account_code: string, bucket_id: string }[]
): AggregatedResult[] => {
  const codeToBucketMap = new Map(mappings.map(m => [m.account_code, m.bucket_id]));
  const bucketSums: Record<string, number> = {};

  for (const rb of rawBalances) {
    const bucketId = codeToBucketMap.get(rb.account_code);
    if (bucketId) {
      bucketSums[bucketId] = (bucketSums[bucketId] || 0) + rb.balance;
    }
  }

  return buckets.map(b => ({
    bucketId: b.id,
    bucketName: b.name,
    macroClass: b.macro_class,
    totalBalance: calculateNormalizedBalance(b.macro_class, bucketSums[b.id] || 0)
  }));
};
