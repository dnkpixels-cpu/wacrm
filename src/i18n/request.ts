import {getRequestConfig} from 'next-intl/server';
import enMessages from '../../messages/en.json';
import koMessages from '../../messages/ko.json';

type MessageTree = Record<string, unknown>;

function mergeMessages(base: MessageTree, overrides: MessageTree): MessageTree {
  const result: MessageTree = {...base};

  for (const [key, value] of Object.entries(overrides)) {
    const baseValue = result[key];

    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      baseValue &&
      typeof baseValue === 'object' &&
      !Array.isArray(baseValue)
    ) {
      result[key] = mergeMessages(
        baseValue as MessageTree,
        value as MessageTree,
      );
    } else {
      result[key] = value;
    }
  }

  return result;
}

const LOCALES = {
  en: enMessages as MessageTree,
  ko: koMessages as MessageTree,
} as const;

export default getRequestConfig(async () => {
  // Keep the runtime locale constrained to dictionaries that are actually
  // shipped with the app. An invalid Hostinger env var must never result in
  // an empty message catalogue or raw translation keypaths in the UI.
  const requestedLocale =
    process.env.NEXT_PUBLIC_APP_LOCALE?.trim().toLowerCase() || 'en';
  const locale = requestedLocale in LOCALES ? requestedLocale : 'en';
  const messages = mergeMessages(enMessages as MessageTree, LOCALES[locale as keyof typeof LOCALES]);

  return {
    locale,
    messages,
  };
});
