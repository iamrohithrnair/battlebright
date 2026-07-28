import clsx, { type ClassValue } from 'clsx';

/** Conditional className helper used by every component in the app. */
export const cn = (...inputs: ClassValue[]) => clsx(inputs);
