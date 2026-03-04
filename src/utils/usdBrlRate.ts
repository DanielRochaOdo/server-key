const USD_BRL_ENDPOINT = 'https://economia.awesomeapi.com.br/json/last/USD-BRL';

export const USD_BRL_RATE_CACHE_KEY = 'serverkey:usd_brl_rate';
export const USD_BRL_RATE_DATE_KEY = 'serverkey:usd_brl_rate_date';

export const getLocalDateKey = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const toNumber = (value: unknown) => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

export const fetchUsdBrlRate = async () => {
  const response = await fetch(USD_BRL_ENDPOINT);
  if (!response.ok) {
    throw new Error(`Falha ao buscar cotacao USD/BRL (${response.status}).`);
  }
  const data = await response.json().catch(() => null);
  const rate = toNumber(data?.USDBRL?.bid);
  if (!rate) {
    throw new Error('Resposta invalida da cotacao USD/BRL.');
  }
  return rate;
};

export const getUsdBrlRate = async (options?: { forceRefresh?: boolean }) => {
  if (typeof window === 'undefined') {
    return fetchUsdBrlRate();
  }

  const today = getLocalDateKey();
  const cachedDate = localStorage.getItem(USD_BRL_RATE_DATE_KEY);
  const cachedRate = toNumber(localStorage.getItem(USD_BRL_RATE_CACHE_KEY));

  if (!options?.forceRefresh && cachedDate === today && cachedRate) {
    return cachedRate;
  }

  const rate = await fetchUsdBrlRate();
  localStorage.setItem(USD_BRL_RATE_DATE_KEY, today);
  localStorage.setItem(USD_BRL_RATE_CACHE_KEY, rate.toString());
  return rate;
};
