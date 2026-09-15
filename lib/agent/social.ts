import type { ReleaseSocial } from './types';

export function buildSocialPackage(input: {
  trackTitle: string;
  catalog: string;
  socialAngle: string;
}): ReleaseSocial {
  const tags = ['#GloomCake', '#ExperimentalHipHop', '#UndergroundHipHop', '#ExperimentalBass'];
  const shortCaption = `${input.trackTitle}.\n\n${input.socialAngle}.\n\n${tags.join(' ')}`;

  return {
    tiktok: shortCaption,
    instagram: `${shortCaption}\n\n${input.catalog}`,
    youtubeShortTitle: `${input.trackTitle} — GloomCake | ${input.catalog}`,
    youtubeShortDescription: `${input.trackTitle} by GloomCake.\n\n${input.socialAngle}.\n\n${tags.join(' ')}`,
    soundcloudDescription: `${input.socialAngle}.\n\nExperimental hip-hop dragged through huge low-end, hollow space and warped bass.\n\n${input.catalog} — GloomCake`,
    soundcloudTags: [
      'experimental hip hop',
      'underground hip hop',
      'alternative hip hop',
      'experimental bass',
      'halftime',
      'gravetrap',
      'leftfield bass',
      'GloomCake',
    ],
  };
}
