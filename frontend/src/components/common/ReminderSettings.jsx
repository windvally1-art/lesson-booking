const LABELS = [
  { key: 'remind_1day',  label: '1일 전' },
  { key: 'remind_1hour', label: '1시간 전' },
  { key: 'remind_10min', label: '10분 전' },
]

export default function ReminderSettings({ value, onChange }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-gray-600 mb-2">🔔 수업 알림 시간</p>
      <div className="flex gap-3 flex-wrap">
        {LABELS.map(({ key, label }) => (
          <label key={key} className="flex items-center gap-1.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={value[key]}
              onChange={e => onChange({ ...value, [key]: e.target.checked })}
              className="w-4 h-4 accent-teal-500 rounded"
            />
            <span className="text-sm text-gray-700">{label}</span>
          </label>
        ))}
      </div>
    </div>
  )
}
