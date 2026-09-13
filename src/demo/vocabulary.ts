// Data only. Every artist and track name the demo shows is assembled from these lists, so none of
// them is a real artist. Words that pair into a famous band name were left out on purpose: "Kites"
// was dropped because "Paper" + "Kites" is The Paper Kites.

export const GENRE_CLUSTERS = {
  indie: ['indie rock', 'indie pop', 'bedroom pop', 'dream pop', 'shoegaze'],
  electronic: ['house', 'deep house', 'techno', 'synthwave', 'ambient'],
  hiphop: ['hip hop', 'trap', 'boom bap', 'alternative hip hop', 'drill'],
  rnb: ['r&b', 'neo soul', 'alternative r&b', 'soul', 'funk'],
  rock: ['alternative rock', 'post-punk', 'garage rock', 'grunge', 'hard rock'],
  folk: ['indie folk', 'singer-songwriter', 'americana', 'folk pop', 'chamber folk'],
  pop: ['pop', 'dance pop', 'electropop', 'art pop', 'hyperpop'],
  afro: ['afrobeats', 'afropop', 'amapiano', 'highlife', 'alté'],
  latin: ['reggaeton', 'latin pop', 'bossa nova', 'cumbia', 'dembow'],
  jazz: ['jazz', 'nu jazz', 'jazz fusion', 'lo-fi beats', 'vocal jazz'],
} as const

export type GenreCluster = keyof typeof GENRE_CLUSTERS

export const BAND_ADJECTIVES = [
  'Velvet', 'Paper', 'Hollow', 'Amber', 'Neon', 'Quiet', 'Silver', 'Static', 'Lunar', 'Copper',
  'Faded', 'Glass', 'Coral', 'Violet', 'Distant', 'Soft', 'Marble', 'Cinder', 'Saffron', 'Indigo',
  'Paler', 'Northern', 'Sunken', 'Gilded', 'Rusted', 'Crimson', 'Pastel', 'Winter', 'Humming',
  'Drifting', 'Burnt', 'Pale', 'Tender', 'Wandering', 'Slow', 'Foggy',
  'Muted', 'Hazel', 'Brittle', 'Sleepless', 'Tangerine', 'Opal', 'Lilac', 'Ashen', 'Dappled',
  'Hushed', 'Crooked', 'Sable', 'Wistful', 'Feral', 'Mellow', 'Honeyed', 'Starlit', 'Salted',
  'Unmoored', 'Velour', 'Bitter', 'Cobalt', 'Evening', 'Heather', 'Ivory', 'Juniper', 'Kindred',
  'Linen', 'Midnight', 'Olive', 'Pewter', 'Rosy', 'Scarlet', 'Thistle', 'Umber', 'Willow',
] as const

export const BAND_NOUNS = [
  'Harbor', 'Lanterns', 'Orchard', 'Meridian', 'Tides', 'Parade', 'Satellites', 'Canyon', 'Comet',
  'Atlas', 'Signal', 'Harvest', 'Meadow', 'Current', 'Lagoon', 'Ferns', 'Quarry', 'Pilots',
  'Arcade', 'Orbit', 'Moths', 'Reservoir', 'Pinwheels', 'Estuary', 'Lighthouse', 'Pines', 'Relay',
  'Terrace', 'Glacier', 'Cascade', 'Prism', 'Swallows', 'Motel', 'Ferris', 'Hedgerow', 'Dunes',
  'Aviary', 'Boulevard', 'Cartographers', 'Dovetail', 'Embers', 'Foxgloves', 'Gondolas', 'Hallways',
  'Inlet', 'Jetty', 'Keepsakes', 'Lullabies', 'Mariners', 'Nightjars', 'Oxbow', 'Pavilion', 'Quilts',
  'Rafters', 'Sparrows', 'Thickets', 'Verandas', 'Wharf', 'Zephyrs', 'Almanac', 'Bellows', 'Chimneys',
  'Eddies', 'Flotilla', 'Greenhouse', 'Hatchery', 'Isthmus', 'Junctions', 'Kilns', 'Lowlands',
  'Undertow', 'Driftwood',
] as const

export const FIRST_NAMES = [
  'Mara', 'Theo', 'Noor', 'Juno', 'Idris', 'Lena', 'Oskar', 'Ines', 'Remy', 'Talia',
  'Kofi', 'Amara', 'Felix', 'Yara', 'Cal', 'Nia', 'Ezra', 'Lior', 'Wren', 'Soren',
  'Ada', 'Milo', 'Zola', 'Rafe', 'Elio', 'Priya', 'Tomas', 'Kenji', 'Ayo', 'Maren',
  'Dario', 'Suki', 'Otis', 'Leona', 'Bram', 'Imani', 'Joaquin', 'Freya', 'Tobi', 'Clio',
  'Anouk', 'Bastian', 'Celeste', 'Dagny', 'Emeka', 'Farah', 'Gideon', 'Hana', 'Ilse', 'Jonah',
  'Kaia', 'Lucan', 'Mireille', 'Nadia', 'Orla', 'Pascal', 'Quentin', 'Rosalind', 'Sami', 'Tamsin',
  'Ulla', 'Vikram', 'Wynne', 'Xavi', 'Yusuf', 'Zaid', 'Bea', 'Cyrus', 'Delphine', 'Eamon',
  'Greta', 'Hugo', 'Isolde', 'Jude', 'Kiri', 'Linus', 'Marisol', 'Nils', 'Odile', 'Rui',
] as const

export const LAST_NAMES = [
  'Quill', 'Vale', 'Rowe', 'Hart', 'Lune', 'Okafor', 'Marsh', 'Voss', 'Calder', 'Reyes',
  'Fenn', 'Ashby', 'Nakamura', 'Bello', 'Lark', 'Crane', 'Moreau', 'Solis', 'Adeyemi', 'Kestrel',
  'Thorne', 'Halloway', 'Castell', 'Pryor', 'Linden', 'Ruiz', 'Soto', 'Brandt', 'Ivers', 'Holm',
  'Achebe', 'Dunmore', 'Varga', 'Sato', 'Ferreira', 'Lindqvist', 'Obi', 'Carrow', 'Mendez', 'Wolcott',
  'Abernathy', 'Blackwood', 'Corrigan', 'Delacroix', 'Eskildsen', 'Fairweather', 'Gallo', 'Haddad',
  'Ishikawa', 'Jablonski', 'Kowalczyk', 'Lachance', 'Mwangi', 'Nordin', 'Oyelaran', 'Petrakis',
  'Quintero', 'Rasmussen', 'Szabo', 'Takahashi', 'Umeh', 'Valdivia', 'Whitlock', 'Xu', 'Yilmaz',
  'Zeller', 'Ambrose', 'Beaumont', 'Cordero', 'Dalgaard', 'Eberhardt', 'Fontaine', 'Grieve', 'Hollis',
  'Ingram', 'Jovanovic', 'Kasprzak', 'Lund', 'Morrow', 'Nyberg',
] as const

/**
 * Hand-placed names that exercise sorting: base-equal accent/case variants (distinct artists) and
 * a leading-lowercase name.
 */
export const VARIANT_ARTIST_NAMES = [
  'Émile Rowe',
  'emile rowe',
  'Noémi Vale',
  'Noemi Vale',
  'sleepwalk club',
] as const

export const TITLE_WORDS = [
  'Afterglow', 'Blue Hour', 'Satellite', 'Undertow', 'Paper Moon', 'Low Tide', 'Headlights',
  'Slow Motion', 'Glasshouse', 'Northbound', 'Static', 'Wildflower', 'Night Bus', 'Echo Park',
  'Porcelain', 'Heatwave', 'Sidewalk', 'Lucid', 'Overpass', 'Daydream', 'Cold Water', 'Marigold',
  'Radio Silence', 'Late Checkout', 'Honey', 'Monsoon', 'Tunnel Vision', 'Soft Launch', 'Orbit',
  'Holding Pattern', 'Golden Hour', 'Weightless', 'Aftertaste', 'Fever Dream', 'Rearview',
  'Snow Globe', 'Parallel', 'Kerosene', 'Paperweight', 'Streetlight',
] as const

export const TITLE_SUFFIXES = [
  '', '', '', '', '', '(Interlude)', '(Acoustic)', 'Part II', '(Reprise)', '(Late Night Mix)',
] as const
