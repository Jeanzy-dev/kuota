export type SupportedCurrency = 'COP' | 'USD' | 'EUR' | 'MXN';

export interface CurrencyConfig {
  code: SupportedCurrency;
  symbol: string;
  label: string;
  thousandsSeparator: string;
  decimalSeparator: string;
  fractionDigits: number;
}

export const CURRENCY_CONFIGS: Record<SupportedCurrency, CurrencyConfig> = {
  COP: {
    code: 'COP',
    symbol: '$',
    label: 'COP — Peso Colombiano ($1.500.000)',
    thousandsSeparator: '.',
    decimalSeparator: ',',
    fractionDigits: 0,
  },
  USD: {
    code: 'USD',
    symbol: 'US$',
    label: 'USD — Dólar Estadounidense (US$1,500.00)',
    thousandsSeparator: ',',
    decimalSeparator: '.',
    fractionDigits: 2,
  },
  EUR: {
    code: 'EUR',
    symbol: '€',
    label: 'EUR — Euro (€1.500,00)',
    thousandsSeparator: '.',
    decimalSeparator: ',',
    fractionDigits: 2,
  },
  MXN: {
    code: 'MXN',
    symbol: 'MX$',
    label: 'MXN — Peso Mexicano (MX$1,500.00)',
    thousandsSeparator: ',',
    decimalSeparator: '.',
    fractionDigits: 2,
  },
};

/**
 * Formatea un valor numérico con separadores de miles y decimales según la divisa del usuario
 * Regla SRS 2.1: "Configuración Monetaria: Selección de divisa principal (por defecto COP / USD
 * con formato de separadores de miles y decimales)"
 */
export function formatCurrency(
  value: number | string | null | undefined,
  currencyCode: string = 'COP',
  forceDecimals?: boolean
): string {
  const num = Number(value ?? 0);
  if (Number.isNaN(num)) return '$0';

  const cfg = CURRENCY_CONFIGS[(currencyCode as SupportedCurrency) || 'COP'] || CURRENCY_CONFIGS.COP;
  const isNegative = num < 0;
  const absVal = Math.abs(num);

  const decimalsToUse =
    forceDecimals !== undefined
      ? forceDecimals
        ? 2
        : 0
      : cfg.code === 'COP' && Number.isInteger(Math.round(absVal * 100) / 100)
        ? 0
        : cfg.fractionDigits;

  const fixed = absVal.toFixed(decimalsToUse);
  const [intPart, decPart] = fixed.split('.');

  const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, cfg.thousandsSeparator);
  const formattedDec = decPart ? `${cfg.decimalSeparator}${decPart}` : '';

  return `${isNegative ? '-' : ''}${cfg.symbol}${formattedInt}${formattedDec}`;
}
