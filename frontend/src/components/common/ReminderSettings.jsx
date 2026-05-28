import { useTranslation } from 'react-i18next'

export default function ReminderSettings({ value, onChange }) {
  const { t } = useTranslation()

  const LABELS = [
    { key: 'remind_1day',  label: t('reminder.1day') },
    { key: 'remind_1hour', label: t('reminder.1hour') },
    { key: 'remind_10min', label: t('reminder.10min') },
  ]

  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-gray-600 mb-2">🔔 {t('reminder.title')}</p>
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
