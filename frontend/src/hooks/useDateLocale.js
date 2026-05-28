import { useTranslation } from 'react-i18next'
import { ko } from 'date-fns/locale'
import { ja } from 'date-fns/locale'

export function useDateLocale() {
  const { i18n } = useTranslation()
  return i18n.language === 'ja' ? ja : ko
}
