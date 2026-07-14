/**
 * Detects which membership / booking / billing platform a club's website uses,
 * by looking for known provider signatures in the raw page HTML (script src,
 * iframe src, anchor href, and inline text). This runs on the unmodified HTML
 * (before scripts are stripped) so we can see embedded widgets and SDKs.
 */

interface PlatformSignature {
  /** Human-readable platform name shown in the UI. */
  name: string;
  /** Lowercased substrings; a match on any one identifies the platform. */
  patterns: string[];
}

// Ordered roughly by specificity so more distinctive providers win ties.
const PLATFORMS: PlatformSignature[] = [
  { name: 'ClubSpark', patterns: ['clubspark.co.uk', 'clubspark.lta.org.uk', 'clubspark'] },
  { name: 'CourtReserve', patterns: ['courtreserve.com', 'courtreserve'] },
  { name: 'Playtomic', patterns: ['playtomic.io', 'playtomic'] },
  { name: 'Mindbody', patterns: ['mindbodyonline.com', 'mindbody', 'mb.md'] },
  { name: 'TeamUp', patterns: ['goteamup.com', 'teamup.com'] },
  { name: 'EZFacility', patterns: ['ezfacility.com', 'ezfacility'] },
  { name: 'Perfect Gym', patterns: ['perfectgym.com', 'perfectgym'] },
  { name: 'Wild Apricot', patterns: ['wildapricot.com', 'wildapricot', 'wildapricot.org'] },
  { name: 'Glofox', patterns: ['glofox.com', 'glofox'] },
  { name: 'Virtuagym', patterns: ['virtuagym.com', 'virtuagym'] },
  { name: 'Gymcatch', patterns: ['gymcatch.com', 'gymcatch'] },
  { name: 'Sportsbooking', patterns: ['sportsbooking.co.uk'] },
  { name: 'MYCLUB', patterns: ['myclub.pro', 'myclub.com'] },
  { name: 'Jonas Club Software', patterns: ['jonasclub.com', 'jonasclubsoftware'] },
  { name: 'ClubManager', patterns: ['clubmanager.net', 'clubmanager.co.uk'] },
  { name: 'RacketPro', patterns: ['racketpro'] },
  { name: 'MatchPoint', patterns: ['matchpointsoftware', 'matchpoint.com.es'] },
  { name: 'SquashLevels', patterns: ['squashlevels.com'] },
  { name: 'PlayWaze', patterns: ['playwaze.com', 'playwaze'] },
  { name: 'Spond', patterns: ['spond.com'] },
  { name: 'Sportlomo', patterns: ['sportlomo.com', 'sportlomo'] },
  { name: 'LoveAdmin', patterns: ['loveadmin.com', 'loveadmin'] },
  { name: 'Clubforce', patterns: ['clubforce.com', 'clubforce'] },
  { name: 'Ashbourne Membership', patterns: ['ashbournemembership.com', 'ashbourne-memberships'] },
  { name: 'GymMaster', patterns: ['gymmaster.com'] },
];

/**
 * Returns the name of the first membership/billing platform whose signature is
 * present in the HTML, or null if none is recognised.
 */
export function detectMembershipSystem(html: string | null | undefined): string | null {
  if (!html) return null;
  const haystack = html.toLowerCase();
  for (const platform of PLATFORMS) {
    if (platform.patterns.some((p) => haystack.includes(p))) {
      return platform.name;
    }
  }
  return null;
}
