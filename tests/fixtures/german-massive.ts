import {
  area,
  climate,
  device,
  door,
  fixture,
  floor,
  humiditySensor,
  light,
  motion,
  occupancy,
  registryEntry,
  switch_,
  tempSensor,
} from './_builder/index.js'

const FX = 'german-massive'

// ── Floors ───────────────────────────────────────────────────────
const eg = floor('Erdgeschoss', { level: 0, icon: 'mdi:home-floor-g' })
const og = floor('Obergeschoss', { level: 1, icon: 'mdi:home-floor-1' })
const keller = floor('Keller', { level: -1, icon: 'mdi:home-floor-b' })

// ── Areas (German names with diacritics) ─────────────────────────
const kueche = area('Küche', { floor: eg.id, icon: 'mdi:silverware-fork-knife' })
const wohnzimmer = area('Wohnzimmer', { floor: eg.id, icon: 'mdi:sofa' })
const esszimmer = area('Esszimmer', { floor: eg.id, icon: 'mdi:silverware' })
const badEg = area('Bad EG', { floor: eg.id, icon: 'mdi:shower' })
const flur = area('Flur', { floor: eg.id, icon: 'mdi:door' })
const garage = area('Garage', { floor: eg.id, icon: 'mdi:garage-variant' })
const schlafzimmer = area('Schlafzimmer', { floor: og.id, icon: 'mdi:bed' })
const kinderzimmer = area('Kinderzimmer', { floor: og.id, icon: 'mdi:teddy-bear' })
const badOg = area('Bad OG', { floor: og.id, icon: 'mdi:shower' })
const gaestezimmer = area('Gästezimmer', { floor: og.id, icon: 'mdi:bed-empty' })
const kellerArea = area('Keller', { floor: keller.id, icon: 'mdi:stairs-down' })
const waschkueche = area('Waschküche', { floor: keller.id, icon: 'mdi:washing-machine' })
const hobbyraum = area('Hobbyraum', { floor: keller.id, icon: 'mdi:tools' })

// ── Devices ──────────────────────────────────────────────────────
const kuecheHue = device('Küche Hue', { manufacturer: 'Philips', area: kueche.id })
const kuecheBosch = device('Küche Bosch', { manufacturer: 'Bosch', area: kueche.id })
const kuecheAqara = device('Küche Aqara TH', { manufacturer: 'Aqara', area: kueche.id })

const wzHue = device('Wohnzimmer Hue', { manufacturer: 'Philips', area: wohnzimmer.id })
const wzAqara = device('Wohnzimmer Aqara TH', { manufacturer: 'Aqara', area: wohnzimmer.id })
const wzTado = device('Wohnzimmer Tado', { manufacturer: 'tado', area: wohnzimmer.id })
const wzSamsung = device('Wohnzimmer Samsung TV', {
  manufacturer: 'Samsung',
  area: wohnzimmer.id,
})

const ezHue = device('Esszimmer Hue', { manufacturer: 'Philips', area: esszimmer.id })

const badEgHue = device('Bad EG Hue', { manufacturer: 'Philips', area: badEg.id })
const badEgAqara = device('Bad EG Aqara TH', { manufacturer: 'Aqara', area: badEg.id })

const badOgHue = device('Bad OG Hue', { manufacturer: 'Philips', area: badOg.id })

const szHue = device('Schlafzimmer Hue', { manufacturer: 'Philips', area: schlafzimmer.id })
const szTado = device('Schlafzimmer Tado', { manufacturer: 'tado', area: schlafzimmer.id })
const szShelly = device('Schlafzimmer Shelly Blinds', {
  manufacturer: 'Shelly',
  area: schlafzimmer.id,
})

const kzHue = device('Kinderzimmer Hue', { manufacturer: 'Philips', area: kinderzimmer.id })

const gzHue = device('Gästezimmer Hue', { manufacturer: 'Philips', area: gaestezimmer.id })

const flurHue = device('Flur Hue', { manufacturer: 'Philips', area: flur.id })

const garageShelly = device('Garage Shelly', { manufacturer: 'Shelly', area: garage.id })

const kellerHue = device('Keller Hue', { manufacturer: 'Philips', area: kellerArea.id })

const wkBosch = device('Waschküche Bosch', { manufacturer: 'Bosch', area: waschkueche.id })

const hobbyHue = device('Hobbyraum Hue', { manufacturer: 'Philips', area: hobbyraum.id })

const gartenHue = device('Garten Hue', { manufacturer: 'Philips' })
// Garten/Terrasse area-less devices — entities tagged via friendlyName only

// ── Entities — Erdgeschoss ───────────────────────────────────────
const kuecheEntities = [
  light(FX, 'Küche Deckenlicht', { area: kueche.id, device: kuecheHue.id }),
  light(FX, 'Küche Spüle Lampe', { area: kueche.id, device: kuecheHue.id }),
  light(FX, 'Küche Arbeitsplatte', { area: kueche.id, device: kuecheHue.id }),
  switch_(FX, 'Küche Backofen', { area: kueche.id, device: kuecheBosch.id }),
  switch_(FX, 'Küche Geschirrspüler', { area: kueche.id, device: kuecheBosch.id }),
  switch_(FX, 'Küche Kühlschrank', { area: kueche.id }),
  motion(FX, 'Küche Bewegung', { area: kueche.id }),
  tempSensor(FX, 'Küche Temperatur', { area: kueche.id, device: kuecheAqara.id }),
  humiditySensor(FX, 'Küche Luftfeuchtigkeit', { area: kueche.id, device: kuecheAqara.id }),
  registryEntry(FX, 'sensor', 'Küche Helligkeit', { area: kueche.id }),
]

const wohnzimmerEntities = [
  light(FX, 'Wohnzimmer Deckenlicht', { area: wohnzimmer.id, device: wzHue.id }),
  light(FX, 'Wohnzimmer Stehlampe', { area: wohnzimmer.id, device: wzHue.id }),
  light(FX, 'Wohnzimmer Couch Lampe', { area: wohnzimmer.id, device: wzHue.id }),
  registryEntry(FX, 'media_player', 'Wohnzimmer Samsung TV', {
    area: wohnzimmer.id,
    device: wzSamsung.id,
  }),
  climate(FX, 'Wohnzimmer Heizung', { area: wohnzimmer.id, device: wzTado.id }),
  motion(FX, 'Wohnzimmer Bewegung', { area: wohnzimmer.id }),
  tempSensor(FX, 'Wohnzimmer Temperatur', { area: wohnzimmer.id, device: wzAqara.id }),
  humiditySensor(FX, 'Wohnzimmer Luftfeuchtigkeit', { area: wohnzimmer.id, device: wzAqara.id }),
  occupancy(FX, 'Wohnzimmer Anwesenheit', { area: wohnzimmer.id }),
  switch_(FX, 'Wohnzimmer Steckdose links', { area: wohnzimmer.id }),
]

const esszimmerEntities = [
  light(FX, 'Esszimmer Hängelampe', { area: esszimmer.id, device: ezHue.id }),
  light(FX, 'Esszimmer Wandlampe', { area: esszimmer.id, device: ezHue.id }),
  motion(FX, 'Esszimmer Bewegung', { area: esszimmer.id }),
  tempSensor(FX, 'Esszimmer Temperatur', { area: esszimmer.id }),
  switch_(FX, 'Esszimmer Steckdose Tisch', { area: esszimmer.id }),
]

const badEgEntities = [
  light(FX, 'Bad EG Deckenlicht', { area: badEg.id, device: badEgHue.id }),
  switch_(FX, 'Bad EG Lüfter', { area: badEg.id }),
  switch_(FX, 'Bad EG Handtuchwärmer', { area: badEg.id }),
  motion(FX, 'Bad EG Bewegung', { area: badEg.id }),
  humiditySensor(FX, 'Bad EG Luftfeuchtigkeit', { area: badEg.id, device: badEgAqara.id }),
  tempSensor(FX, 'Bad EG Temperatur', { area: badEg.id, device: badEgAqara.id }),
]

const flurEntities = [
  light(FX, 'Flur Deckenlicht 1', { area: flur.id, device: flurHue.id }),
  light(FX, 'Flur Deckenlicht 2', { area: flur.id, device: flurHue.id }),
  motion(FX, 'Flur Bewegung Eingang', { area: flur.id }),
  motion(FX, 'Flur Bewegung Treppe', { area: flur.id }),
  occupancy(FX, 'Flur Anwesenheit', { area: flur.id }),
  switch_(FX, 'Flur Schalter Garderobe', { area: flur.id }),
]

const garageEntities = [
  registryEntry(FX, 'cover', 'Garage Tor', { area: garage.id, device: garageShelly.id }),
  light(FX, 'Garage Deckenlicht', { area: garage.id }),
  motion(FX, 'Garage Bewegung', { area: garage.id }),
  tempSensor(FX, 'Garage Temperatur', { area: garage.id }),
  switch_(FX, 'Garage Steckdose Werkbank', { area: garage.id }),
]

// ── Entities — Obergeschoss ──────────────────────────────────────
const schlafzimmerEntities = [
  light(FX, 'Schlafzimmer Deckenlicht', { area: schlafzimmer.id, device: szHue.id }),
  light(FX, 'Schlafzimmer Bett links', { area: schlafzimmer.id, device: szHue.id }),
  light(FX, 'Schlafzimmer Bett rechts', { area: schlafzimmer.id, device: szHue.id }),
  occupancy(FX, 'Schlafzimmer Anwesenheit', { area: schlafzimmer.id }),
  climate(FX, 'Schlafzimmer Heizung', { area: schlafzimmer.id, device: szTado.id }),
  tempSensor(FX, 'Schlafzimmer Temperatur', { area: schlafzimmer.id }),
  humiditySensor(FX, 'Schlafzimmer Luftfeuchtigkeit', { area: schlafzimmer.id }),
  registryEntry(FX, 'cover', 'Schlafzimmer Rollladen', {
    area: schlafzimmer.id,
    device: szShelly.id,
  }),
  motion(FX, 'Schlafzimmer Bewegung', { area: schlafzimmer.id }),
]

const kinderzimmerEntities = [
  light(FX, 'Kinderzimmer Deckenlicht', { area: kinderzimmer.id, device: kzHue.id }),
  light(FX, 'Kinderzimmer Nachtlicht', { area: kinderzimmer.id, device: kzHue.id }),
  motion(FX, 'Kinderzimmer Bewegung', { area: kinderzimmer.id }),
  tempSensor(FX, 'Kinderzimmer Temperatur', { area: kinderzimmer.id }),
  humiditySensor(FX, 'Kinderzimmer Luftfeuchtigkeit', { area: kinderzimmer.id }),
  switch_(FX, 'Kinderzimmer Steckdose Schreibtisch', { area: kinderzimmer.id }),
]

const badOgEntities = [
  light(FX, 'Bad OG Spiegellicht', { area: badOg.id, device: badOgHue.id }),
  switch_(FX, 'Bad OG Lüftung', { area: badOg.id }),
  motion(FX, 'Bad OG Bewegung', { area: badOg.id }),
  humiditySensor(FX, 'Bad OG Luftfeuchtigkeit', { area: badOg.id }),
  tempSensor(FX, 'Bad OG Temperatur', { area: badOg.id }),
]

const gaestezimmerEntities = [
  light(FX, 'Gästezimmer Deckenlicht', { area: gaestezimmer.id, device: gzHue.id }),
  motion(FX, 'Gästezimmer Bewegung', { area: gaestezimmer.id }),
  tempSensor(FX, 'Gästezimmer Temperatur', { area: gaestezimmer.id }),
  switch_(FX, 'Gästezimmer Steckdose', { area: gaestezimmer.id }),
]

// ── Entities — Keller ────────────────────────────────────────────
const kellerEntities = [
  light(FX, 'Keller Deckenlicht 1', { area: kellerArea.id, device: kellerHue.id }),
  light(FX, 'Keller Deckenlicht 2', { area: kellerArea.id, device: kellerHue.id }),
  motion(FX, 'Keller Bewegung', { area: kellerArea.id }),
  humiditySensor(FX, 'Keller Luftfeuchtigkeit', { area: kellerArea.id }),
  registryEntry(FX, 'binary_sensor', 'Keller Wassermelder', {
    area: kellerArea.id,
  }),
  tempSensor(FX, 'Keller Temperatur', { area: kellerArea.id }),
]

const waschkuecheEntities = [
  switch_(FX, 'Waschküche Waschmaschine', { area: waschkueche.id, device: wkBosch.id }),
  switch_(FX, 'Waschküche Trockner', { area: waschkueche.id, device: wkBosch.id }),
  light(FX, 'Waschküche Deckenlicht', { area: waschkueche.id }),
  motion(FX, 'Waschküche Bewegung', { area: waschkueche.id }),
  humiditySensor(FX, 'Waschküche Luftfeuchtigkeit', { area: waschkueche.id }),
  registryEntry(FX, 'binary_sensor', 'Waschküche Wassermelder', {
    area: waschkueche.id,
  }),
  tempSensor(FX, 'Waschküche Temperatur', { area: waschkueche.id }),
]

const hobbyraumEntities = [
  light(FX, 'Hobbyraum Deckenlicht', { area: hobbyraum.id, device: hobbyHue.id }),
  motion(FX, 'Hobbyraum Bewegung', { area: hobbyraum.id }),
  switch_(FX, 'Hobbyraum Steckdose Werkbank', { area: hobbyraum.id }),
]

// ── Entities — outdoor (no area, friendly_name signal only) ─────
const outdoorEntities = [
  light(FX, 'Outdoor Light Garten', { device: gartenHue.id }),
  light(FX, 'Garten Wegbeleuchtung', { device: gartenHue.id }),
  light(FX, 'Terrasse Lampe', { device: gartenHue.id }),
  registryEntry(FX, 'sensor', 'Garten Wetter', {}),
  occupancy(FX, 'Garten Anwesenheit', {}),
  door(FX, 'Garten Tor Sensor', {}),
  tempSensor(FX, 'Garten Temperatur Außen', {}),
]

// ── Floating diagnostic / hidden / disabled (no area) ────────────
const floatingEntities = [
  registryEntry(FX, 'sensor', 'Sonoff Diagnostic Uptime', { entityCategory: 'diagnostic' }),
  registryEntry(FX, 'sensor', 'Sonoff Diagnostic Signal', { entityCategory: 'diagnostic' }),
  registryEntry(FX, 'sensor', 'Sonoff Diagnostic Linkquality', {
    entityCategory: 'diagnostic',
  }),
  registryEntry(FX, 'sensor', 'Hidden Battery Sonoff', { hidden: true }),
  registryEntry(FX, 'sensor', 'Hidden Battery Aqara', { hidden: true }),
  registryEntry(FX, 'sensor', 'Hidden Battery Tado', { hidden: true }),
  registryEntry(FX, 'switch', 'Disabled Old Plug 1', { disabled: true }),
  registryEntry(FX, 'switch', 'Disabled Old Plug 2', { disabled: true }),
  registryEntry(FX, 'switch', 'Disabled Old Plug 3', { disabled: true }),
  registryEntry(FX, 'sensor', 'Disabled Stale Sensor', { disabled: true }),
]

export const germanMassive = fixture({
  meta: {
    name: 'german-massive',
    description:
      '~130 entities across 13 German-named areas spanning Erdgeschoss + ' +
      'Obergeschoss + Keller. Mostly area-attributed; ~7 outdoor entities tagged ' +
      'via friendlyName only (no area_id) and ~10 floating diagnostic / hidden / ' +
      'disabled entries to exercise normalization filters. Validates the new DE ' +
      'keyword pack including diacritic normalization (Küche → kuche), bedroom ' +
      'excludes(["bad"]), bathroom + laundry waschraum overlap, and substring ' +
      'matching across compound German words.',
  },
  floors: [eg, og, keller],
  areas: [
    kueche,
    wohnzimmer,
    esszimmer,
    badEg,
    flur,
    garage,
    schlafzimmer,
    kinderzimmer,
    badOg,
    gaestezimmer,
    kellerArea,
    waschkueche,
    hobbyraum,
  ],
  devices: [
    kuecheHue,
    kuecheBosch,
    kuecheAqara,
    wzHue,
    wzAqara,
    wzTado,
    wzSamsung,
    ezHue,
    badEgHue,
    badEgAqara,
    badOgHue,
    szHue,
    szTado,
    szShelly,
    kzHue,
    gzHue,
    flurHue,
    garageShelly,
    kellerHue,
    wkBosch,
    hobbyHue,
    gartenHue,
  ],
  entities: [
    ...kuecheEntities,
    ...wohnzimmerEntities,
    ...esszimmerEntities,
    ...badEgEntities,
    ...flurEntities,
    ...garageEntities,
    ...schlafzimmerEntities,
    ...kinderzimmerEntities,
    ...badOgEntities,
    ...gaestezimmerEntities,
    ...kellerEntities,
    ...waschkuecheEntities,
    ...hobbyraumEntities,
    ...outdoorEntities,
    ...floatingEntities,
  ],
})
