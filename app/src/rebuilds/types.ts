import type { FC } from 'react';
import type { Font } from './fonts';

export type Param =
  | { key: string; label: string; type: 'text'; default: string; multiline?: boolean }
  | { key: string; label: string; type: 'range'; min: number; max: number; step?: number; default: number; unit?: string }
  | { key: string; label: string; type: 'select'; options: string[]; default: string }
  | { key: string; label: string; type: 'toggle'; default: boolean }
  | { key: string; label: string; type: 'color'; default: string };

export type Values = Record<string, string | number | boolean>;

// A style preset: a font plus overrides for any params (colours, text, sizes),
// usually derived from one of the captured exemplars.
export type Style = { name: string; font: string; values?: Values; note?: string };

export type RebuildProps = { v: Values; font: Font; width: number; height: number };

export type Rebuild = {
  type: string;
  variant: string;
  title: string;
  description: string;
  basedOn: string[]; // instance ids (slug#block) the rebuild was reconstructed from
  params: Param[];
  styles: Style[];
  Component: FC<RebuildProps>;
};

export const defaults = (r: Rebuild): Values => Object.fromEntries(r.params.map((p) => [p.key, p.default]));
