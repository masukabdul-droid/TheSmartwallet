import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowRightLeft, Plus, X } from 'lucide-react';
import { toast } from 'sonner';

interface ExchangeRates {
  [key: string]: number;
}

interface CurrencyData {
  code: string;
  value: string;
}

const DEFAULT_CURRENCIES = ['AED', 'BDT', 'USD', 'EUR'];
const ALL_CURRENCIES = [
  'AED', 'AFN', 'ALL', 'AMD', 'ANG', 'AOA', 'ARS', 'AUD', 'AWG', 'AZN',
  'BAM', 'BBD', 'BDT', 'BGN', 'BHD', 'BIF', 'BMD', 'BND', 'BOB', 'BRL', 'BSD', 'BTC', 'BTN', 'BWP', 'BYN', 'BZD',
  'CAD', 'CDF', 'CHE', 'CHF', 'CHW', 'CLF', 'CLP', 'CNH', 'CNY', 'COP', 'COU', 'CRC', 'CUC', 'CUP', 'CVE', 'CZK',
  'DJF', 'DKK', 'DOP', 'DZD',
  'EGP', 'ERN', 'ETB', 'EUR',
  'FJD', 'FKP',
  'GBP', 'GEL', 'GHS', 'GIP', 'GMD', 'GNF', 'GTQ', 'GYD',
  'HKD', 'HNL', 'HRK', 'HTG', 'HUF',
  'IDR', 'ILS', 'INR', 'IQD', 'IRR', 'ISK',
  'JMD', 'JOD', 'JPY',
  'KES', 'KGS', 'KHR', 'KMF', 'KPW', 'KRW', 'KWD', 'KYD', 'KZT',
  'LAK', 'LBP', 'LKR', 'LRD', 'LSL', 'LYD',
  'MAD', 'MDL', 'MGA', 'MKD', 'MMK', 'MNT', 'MOP', 'MRU', 'MUR', 'MVR', 'MWK', 'MXN', 'MYR', 'MZN',
  'NAD', 'NGN', 'NIO', 'NOK', 'NPR', 'NZD',
  'OMR',
  'PAB', 'PEN', 'PGK', 'PHP', 'PKR', 'PLN', 'PYG',
  'QAR',
  'RON', 'RSD', 'RUB', 'RWF',
  'SAR', 'SBD', 'SCR', 'SDG', 'SEK', 'SGD', 'SHP', 'SLE', 'SLL', 'SOS', 'SRD', 'SSP', 'STN', 'SYP', 'SZL',
  'THB', 'TJS', 'TMT', 'TND', 'TOP', 'TRY', 'TTD', 'TWD', 'TZS',
  'UAH', 'UGX', 'USD', 'UYU', 'UZS',
  'VES', 'VND', 'VUV',
  'WST',
  'XAF', 'XAG', 'XAU', 'XCD', 'XOF', 'XPD', 'XPF', 'XPT',
  'YER',
  'ZAR', 'ZMW', 'ZWL'
];

export default function CurrencyConverter() {
  const [currencies, setCurrencies] = useState<CurrencyData[]>(
    DEFAULT_CURRENCIES.map(code => ({ code, value: '' }))
  );
  const [rates, setRates] = useState<ExchangeRates>({});
  const [loading, setLoading] = useState(true);
  const [baseCurrency, setBaseCurrency] = useState('USD');
  const [showCurrencyPicker, setShowCurrencyPicker] = useState<number | string | null>(null);

  // Fetch exchange rates
  const fetchRates = async (base: string) => {
    try {
      setLoading(true);
      const response = await fetch(
        `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/${base.toLowerCase()}.json`
      );
      if (!response.ok) throw new Error('Failed to fetch rates');
      const data = await response.json();
      setRates(data[base.toLowerCase()] || {});
    } catch (error) {
      console.error('Error fetching rates:', error);
      toast.error('Failed to load exchange rates');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRates(baseCurrency);
  }, [baseCurrency]);

  const handleValueChange = (index: number, newValue: string) => {
    const numValue = parseFloat(newValue) || 0;
    const updatedCurrencies = [...currencies];
    updatedCurrencies[index].value = newValue;

    if (numValue > 0 && rates[updatedCurrencies[index].code.toLowerCase()]) {
      const baseCurrencyRate = rates[baseCurrency.toLowerCase()] || 1;
      const currentCurrencyRate = rates[updatedCurrencies[index].code.toLowerCase()] || 1;
      const conversionFactor = baseCurrencyRate / currentCurrencyRate;

      updatedCurrencies.forEach((curr, i) => {
        if (i !== index) {
          const targetRate = rates[curr.code.toLowerCase()] || 1;
          const converted = (numValue * conversionFactor * targetRate) / baseCurrencyRate;
          curr.value = converted.toFixed(2);
        }
      });
    } else {
      updatedCurrencies.forEach((curr, i) => {
        if (i !== index) curr.value = '';
      });
    }

    setCurrencies(updatedCurrencies);
  };

  const swapCurrencies = (index1: number, index2: number) => {
    const updated = [...currencies];
    [updated[index1], updated[index2]] = [updated[index2], updated[index1]];
    setCurrencies(updated);
  };

  const removeCurrency = (index: number) => {
    if (currencies.length > 2) {
      setCurrencies(currencies.filter((_, i) => i !== index));
    } else {
      toast.error('Keep at least 2 currencies');
    }
  };

  const addCurrency = (code: string) => {
    if (!currencies.find(c => c.code === code)) {
      setCurrencies([...currencies, { code, value: '' }]);
    }
    setShowCurrencyPicker(null);
  };

  const getAvailableCurrencies = () => {
    return ALL_CURRENCIES.filter(code => !currencies.find(c => c.code === code));
  };

  const changeCurrency = (index: number, newCode: string) => {
    const updated = [...currencies];
    updated[index].code = newCode;
    updated[index].value = '';
    setCurrencies(updated);
    setShowCurrencyPicker(null);
  };

  return (
    <div className="w-full">
      {/* Loading state */}
      {loading && (
        <div className="text-center py-8">
          <div className="inline-block animate-spin">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full"></div>
          </div>
          <p className="text-muted-foreground mt-2">Loading exchange rates...</p>
        </div>
      )}

      {/* Currency Converter */}
      {!loading && (
        <div className="space-y-4">
          {currencies.map((currency, index) => (
            <div key={index} className="group">
              <div className="bg-card border border-border rounded-lg p-4 transition-all duration-200 hover:shadow-sm">
                <div className="flex items-center gap-3">
                  {/* Currency selector */}
                  <div className="relative">
                    <button
                      onClick={() => setShowCurrencyPicker(showCurrencyPicker === index ? null : index)}
                      className="px-3 py-2 bg-secondary text-secondary-foreground rounded font-mono font-semibold text-sm hover:bg-muted transition-colors duration-200 min-w-[70px] text-left"
                    >
                      {currency.code}
                    </button>

                    {showCurrencyPicker === index && (
                      <div className="absolute top-full left-0 mt-2 bg-card border border-border rounded-lg shadow-lg z-50 w-64 max-h-64 overflow-y-auto">
                        <div className="max-h-64 overflow-y-auto">
                          {ALL_CURRENCIES.map(code => (
                            <button
                              key={code}
                              onClick={() => changeCurrency(index, code)}
                              className="w-full text-left px-4 py-2 hover:bg-secondary transition-colors text-sm text-foreground"
                            >
                              {code}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Input field */}
                  <input
                    type="number"
                    value={currency.value}
                    onChange={(e) => handleValueChange(index, e.target.value)}
                    placeholder="0.00"
                    className="flex-1 px-4 py-2 bg-background border border-border rounded font-mono text-lg font-semibold text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all duration-200"
                  />

                  {/* Actions */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    {index < currencies.length - 1 && (
                      <button
                        onClick={() => swapCurrencies(index, index + 1)}
                        className="p-2 hover:bg-secondary rounded transition-colors"
                        title="Swap with next"
                      >
                        <ArrowRightLeft className="w-4 h-4 text-muted-foreground" />
                      </button>
                    )}
                    {currencies.length > 2 && (
                      <button
                        onClick={() => removeCurrency(index)}
                        className="p-2 hover:bg-destructive/10 rounded transition-colors"
                        title="Remove"
                      >
                        <X className="w-4 h-4 text-muted-foreground hover:text-destructive" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}

          {/* Add currency button */}
          {currencies.length < 5 && (
            <div className="relative">
              <button
                onClick={() => setShowCurrencyPicker(showCurrencyPicker === 'add' ? null : 'add')}
                className="w-full py-3 border-2 border-dashed border-border rounded-lg text-muted-foreground hover:text-foreground hover:border-primary transition-colors duration-200 flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add Currency
              </button>
              {showCurrencyPicker === 'add' && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-card border border-border rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto">
                  {getAvailableCurrencies().map(code => (
                    <button
                      key={code}
                      onClick={() => addCurrency(code)}
                      className="w-full text-left px-4 py-2 hover:bg-secondary transition-colors text-sm text-foreground"
                    >
                      {code}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Info footer */}
      <div className="mt-8 pt-4 border-t border-border">
        <p className="text-xs text-muted-foreground text-center">
          Exchange rates updated daily • Powered by free API • No registration required
        </p>
      </div>
    </div>
  );
}
