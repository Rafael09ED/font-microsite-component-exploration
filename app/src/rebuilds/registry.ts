import type { Rebuild } from './types';
import { giantWordmark } from './hero/giant-wordmark';
import { sentenceAsSpecimen } from './hero/sentence-as-specimen';
import { kineticType } from './hero/kinetic-type';
import { interactiveSpecimen } from './hero/interactive-specimen';
import { typesetPage } from './hero/typeset-page';
import { miniGame } from './hero/mini-game';
import { perRowControls } from './tester/per-row-controls';
import { globalToolbar } from './tester/global-toolbar';
import { glyphInspector } from './glyphs/glyph-inspector';
import { featureBeforeAfter } from './details/feature-before-after';
import { axisExplainer } from './details/axis-explainer';

export const REBUILDS: Rebuild[] = [
  giantWordmark, sentenceAsSpecimen, kineticType, interactiveSpecimen, typesetPage, miniGame,
  perRowControls, globalToolbar, glyphInspector, featureBeforeAfter, axisExplainer,
];

export const rebuildFor = (type: string, variant: string) => REBUILDS.find((r) => r.type === type && r.variant === variant);
