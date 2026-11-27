import { useState, type FC } from 'react';
import { ChevronDown } from 'lucide-react';
import {
  CHARIOW_COUNTRIES,
  type CountryInfo,
} from '../services/chariow';

interface ChariowCountryPhonePickerProps {
  selectedCountry: CountryInfo;
  phoneNumber: string;
  onCountryChange: (country: CountryInfo) => void;
  onPhoneChange: (localDigits: string) => void;
  compact?: boolean;
}

export const ChariowCountryPhonePicker: FC<ChariowCountryPhonePickerProps> = ({
  selectedCountry,
  phoneNumber,
  onCountryChange,
  onPhoneChange,
  compact = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className={compact ? 'space-y-3' : 'space-y-4'}>
      <div className="space-y-1.5 relative">
        <label className="block text-xs font-medium text-[#A0A5B5]">
          {compact
            ? 'Pays & indicatif de paiement (modifiez si besoin)'
            : "Votre pays de paiement (Afrique de l'Ouest & Centrale) :"}
        </label>

        <button
          type="button"
          onClick={() => setIsOpen((v) => !v)}
          className={`w-full px-3.5 rounded-2xl bg-[#08090E] border border-white/[0.12] hover:border-white/30 flex items-center justify-between text-left text-white transition-all cursor-pointer ${
            compact ? 'h-11 text-sm' : 'h-13 text-base'
          }`}
        >
          <div className="flex items-center gap-2.5 truncate">
            <span className={compact ? 'text-xl leading-none' : 'text-2xl leading-none'}>
              {selectedCountry.flag}
            </span>
            <span className="font-semibold truncate">{selectedCountry.name}</span>
            <span className="text-xs font-mono text-[#A0A5B5]">({selectedCountry.dialCode})</span>
          </div>
          <ChevronDown className={`h-4 w-4 text-[#A0A5B5] shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {isOpen && (
          <div className="absolute top-full left-0 right-0 mt-1.5 max-h-64 overflow-y-auto rounded-2xl bg-[#090A10] border border-white/[0.18] shadow-2xl z-50 p-1.5 space-y-0.5 divide-y divide-white/[0.06]">
            {CHARIOW_COUNTRIES.map((country) => (
              <button
                key={country.code}
                type="button"
                onClick={() => {
                  onCountryChange(country);
                  setIsOpen(false);
                }}
                className={`w-full px-3.5 py-2.5 rounded-xl flex items-center justify-between text-left text-xs sm:text-sm transition-colors cursor-pointer ${
                  selectedCountry.code === country.code
                    ? 'bg-[#E5B54F]/20 text-[#F5D060] font-semibold'
                    : 'text-[#D0D4E0] hover:bg-white/[0.06]'
                }`}
              >
                <div className="flex items-center gap-2.5 truncate">
                  <span className="text-lg">{country.flag}</span>
                  <span className="font-medium">{country.name}</span>
                  <span className="font-mono text-xs text-[#A0A5B5]">{country.dialCode}</span>
                </div>
                <span className="text-[11px] font-mono text-[#8A90A0] shrink-0 truncate max-w-[120px] text-right">
                  {country.operators[0]}
                </span>
              </button>
            ))}
          </div>
        )}

        {!compact && (
          <div className="flex flex-wrap gap-2 pt-1">
            {selectedCountry.operators.map((op) => (
              <span
                key={op}
                className="inline-flex items-center text-xs font-mono px-2.5 py-1 rounded-lg bg-white/[0.05] border border-white/[0.08] text-[#BAC0D4] font-medium"
              >
                {op}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-1.5">
        <label className="block text-xs font-medium text-[#A0A5B5]">
          Numéro Mobile Money (Wave, Orange, Moov, MTN) :
        </label>
        <div className="flex items-center rounded-2xl bg-[#08090E] border border-white/[0.12] focus-within:border-white/40 transition-all overflow-hidden">
          <span
            className={`px-3.5 font-mono text-[#CBD2E1] bg-white/[0.04] border-r border-white/[0.1] flex items-center font-semibold ${
              compact ? 'h-11 text-xs' : 'h-13 text-sm'
            }`}
          >
            {selectedCountry.dialCode}
          </span>
          <input
            type="tel"
            value={phoneNumber}
            onChange={(e) => onPhoneChange(e.target.value.replace(/\D/g, '').slice(0, 12))}
            placeholder="ex: 70 00 00 00"
            className={`flex-1 px-3.5 bg-transparent text-white placeholder-[#606575] focus:outline-none font-mono ${
              compact ? 'h-11 text-sm' : 'h-13 text-base'
            }`}
          />
        </div>
      </div>
    </div>
  );
};
