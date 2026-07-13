import { isPhoneValid } from '@/utils/phoneUtils';

type Language = 'ar' | 'en';

const messages = {
  ar: {
    invalidName: 'الاسم مطلوب ويجب أن لا يقل عن حرفين',
    invalidPhone: 'رقم الهاتف غير صالح',
    missingId: 'الرقم القومي أو رقم جواز السفر مطلوب',
    invalidEgyptianId: 'الرقم القومي المصري يجب أن يكون 14 رقماً ويبدأ بـ 2 أو 3',
    invalidDocument: 'رقم الهوية أو جواز السفر غير صالح',
  },
  en: {
    invalidName: 'Name is required and must be at least 2 characters',
    invalidPhone: 'Phone number is invalid',
    missingId: 'National ID or passport number is required',
    invalidEgyptianId: 'Egyptian national ID must be 14 digits and start with 2 or 3',
    invalidDocument: 'ID or passport number is invalid',
  },
} as const;

export function validateCourseBeneficiary(
  name: string,
  phone: string,
  nationalId: string | null | undefined,
  language: Language,
): string | null {
  const t = messages[language];
  const cleanId = nationalId?.trim() || '';

  if (name.trim().length < 2 || name.trim().length > 120) return t.invalidName;
  if (!isPhoneValid(phone)) return t.invalidPhone;
  if (!cleanId) return t.missingId;
  if (/^\d+$/.test(cleanId)) return /^[23]\d{13}$/.test(cleanId) ? null : t.invalidEgyptianId;

  return /^[A-Za-z0-9 -]{6,20}$/.test(cleanId) && !/^(.)\1+$/i.test(cleanId)
    ? null
    : t.invalidDocument;
}
