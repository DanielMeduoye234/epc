import { Bacenta } from '@/lib/types';

interface SelectOption {
  value: string;
  label: string;
}

interface BacentaSelectProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  bacentas?: Bacenta[];
  options?: SelectOption[];
  required?: boolean;
  includeLeader?: boolean;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
}

export default function BacentaSelect({
  label,
  value,
  onChange,
  bacentas = [],
  options,
  required = false,
  includeLeader = false,
  className,
  placeholder = 'Select a bacenta...',
  disabled = false,
}: BacentaSelectProps) {
  const selectClass = className || 'w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none text-black bg-white';
  const normalizedOptions: SelectOption[] = options || bacentas.map((b) => ({
    value: b.name,
    label: `${b.name}${includeLeader && b.leader_name ? ` - ${b.leader_name}` : ''}`,
  }));
  const hasCurrentValue = normalizedOptions.some((opt) => opt.value === value);

  return (
    <div>
      {label && <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>}
      <select
        required={required}
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={selectClass}
      >
        <option value="">{placeholder}</option>
        {normalizedOptions.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
        {value && !hasCurrentValue && (
          <option value={value}>{value}</option>
        )}
      </select>
    </div>
  );
}
