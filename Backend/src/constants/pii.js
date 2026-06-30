export const PII_TYPES = [
  'NAME',
  'EMAIL',
  'PHONE',
  'ADDRESS',
  'SSN',
  'FINANCIAL_ACCOUNT',
  'GOVERNMENT_ID',
  'DATE_OF_BIRTH',
  'OTHER',
];

export const HIGH_RISK_TYPES = new Set(['SSN', 'FINANCIAL_ACCOUNT', 'GOVERNMENT_ID']);
export const MEDIUM_RISK_TYPES = new Set(['NAME', 'EMAIL', 'PHONE', 'ADDRESS', 'DATE_OF_BIRTH']);

export const getRiskTier = (type) => {
  if (HIGH_RISK_TYPES.has(type)) return 'high';
  if (MEDIUM_RISK_TYPES.has(type)) return 'medium';
  return 'low';
};

export const getRiskWeight = (riskTier) => {
  if (riskTier === 'high') return 3;
  if (riskTier === 'medium') return 2;
  return 1;
};
