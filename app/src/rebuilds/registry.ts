import type { Rebuild } from './types';
import { giantWordmark } from './hero/giant-wordmark';
import { sentenceAsSpecimen } from './hero/sentence-as-specimen';
import { kineticType } from './hero/kinetic-type';
import { interactiveSpecimen } from './hero/interactive-specimen';
import { typesetPage } from './hero/typeset-page';
import { miniGame } from './hero/mini-game';

export const REBUILDS: Rebuild[] = [giantWordmark, sentenceAsSpecimen, kineticType, interactiveSpecimen, typesetPage, miniGame];

export const rebuildFor = (type: string, variant: string) => REBUILDS.find((r) => r.type === type && r.variant === variant);
