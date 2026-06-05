import { Bacenta } from '@/lib/types';

interface BacentaSelectProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  bacentas: Bacenta[];
  required?: boolean;
  includeLeader?: boolean;
  className?: string;
  placeholder?: string;
}

export default function BacentaSelect({
  label,
  value,
  onChange,
  bacentas,
  required = false,
  includeLeader = false,
  className,
  placeholder = 'Select a bacenta...',
}: BacentaSelectProps) {
  const selectClass = className || 'w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none text-black bg-white';

  return (
    <div>
      {label && <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>}
      <select
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={selectClass}
      >
        <option value="">{placeholder}</option>
        {bacentas.map((b) => (
          <option key={b.id} value={b.name}>
            {b.name}
            {includeLeader && b.leader_name ? ` - ${b.leader_name}` : ''}
          </option>
        ))}
        {value && !bacentas.find((b) => b.name === value) && (
          <option value={value}>{value}</option>
        )}
      </select>
    </div>
  );
}
