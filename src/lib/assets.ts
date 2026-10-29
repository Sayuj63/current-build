/**
 * Every file the first screen needs. All of it is open-source — see CREDITS.md.
 * The loader does not report ready until every entry here is downloaded and
 * decoded, so nothing pops in after the portal opens.
 */
/** Kenney Nature Kit boulders. The last two are tall accents, used sparingly. */
export const ROCKS = [
  "rock_largeA",
  "rock_largeB",
  "rock_largeC",
  "rock_largeD",
  "rock_largeE",
  "rock_largeF",
  "stone_largeA",
  "stone_largeB",
  "stone_largeC",
  "stone_largeD",
  "stone_largeE",
  "stone_largeF",
  "rock_tallA",
  "rock_tallE",
].map((n) => `/models/rocks/${n}.glb`);
export const ROCK_ACCENTS = 2;

export const TEXTURES = {
  grassBlades: "/textures/grass_blades.png",
  grassHeads: "/textures/grass_heads.png",
  waterNormals: "/textures/waternormals.jpg",
  cloud: "/textures/cloud.png",
  leaves: "/textures/leaves.png",
};

export const HDRI = "/hdri/sunset_1k.hdr";

export const AUDIO = {
  /** Slow ambient pad, the musical bed. */
  music: "/audio/music.mp3",
  /** Birds and breeze. */
  ambient: "/audio/ambient.mp3",
  /** Low wind, almost subliminal. */
  wind: "/audio/wind.mp3",
  /** One soft whoosh into a swell — plays once as the portal opens. */
  enter: "/audio/enter.mp3",
  /** Soft swell under each chapter change. */
  chapter: "/audio/chapter.mp3",
};
