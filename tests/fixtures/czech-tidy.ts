import {
  area,
  climate,
  device,
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

const FX = 'czech-tidy'

const ground = floor('Přízemí', { level: 0, icon: 'mdi:home-floor-g' })
const upstairs = floor('Patro', { level: 1, icon: 'mdi:home-floor-1' })

const livingRoom = area('Obývací pokoj', { floor: ground.id, icon: 'mdi:sofa' })
const kitchen = area('Kuchyně', { floor: ground.id, icon: 'mdi:silverware-fork-knife' })
const bathroom = area('Koupelna', { floor: ground.id, icon: 'mdi:shower' })
const bedroom = area('Ložnice', { floor: upstairs.id, icon: 'mdi:bed' })
const office = area('Kancelář', { floor: upstairs.id, icon: 'mdi:desk' })

const lrHue = device('Obývací pokoj Hue', { manufacturer: 'Philips', area: livingRoom.id })
const lrAqara = device('Obývací pokoj Aqara TH', { manufacturer: 'Aqara', area: livingRoom.id })
const lrThermostat = device('Obývací pokoj Tado', { manufacturer: 'tado', area: livingRoom.id })

const kitchenHue = device('Kuchyně Hue', { manufacturer: 'Philips', area: kitchen.id })
const kitchenAqara = device('Kuchyně Aqara TH', { manufacturer: 'Aqara', area: kitchen.id })

const bathHue = device('Koupelna Hue', { manufacturer: 'Philips', area: bathroom.id })
const bathAqara = device('Koupelna Aqara TH', { manufacturer: 'Aqara', area: bathroom.id })

const bedHue = device('Ložnice Hue', { manufacturer: 'Philips', area: bedroom.id })
const bedThermostat = device('Ložnice Tado', { manufacturer: 'tado', area: bedroom.id })

const officeHue = device('Kancelář Hue', { manufacturer: 'Philips', area: office.id })

const livingRoomEntities = [
  light(FX, 'Obývací pokoj stropní světlo', { area: livingRoom.id, device: lrHue.id }),
  light(FX, 'Obývací pokoj lampa vlevo', { area: livingRoom.id, device: lrHue.id }),
  light(FX, 'Obývací pokoj lampa vpravo', { area: livingRoom.id, device: lrHue.id }),
  light(FX, 'Obývací pokoj bodové 1', { area: livingRoom.id, device: lrHue.id }),
  light(FX, 'Obývací pokoj bodové 2', { area: livingRoom.id, device: lrHue.id }),
  light(FX, 'Obývací pokoj bodové 3', { area: livingRoom.id, device: lrHue.id }),
  switch_(FX, 'Obývací pokoj zásuvka televize', { area: livingRoom.id }),
  switch_(FX, 'Obývací pokoj podlahové topení', { area: livingRoom.id }),
  tempSensor(FX, 'Obývací pokoj teplota', { area: livingRoom.id, device: lrAqara.id }),
  humiditySensor(FX, 'Obývací pokoj vlhkost', { area: livingRoom.id, device: lrAqara.id }),
  climate(FX, 'Obývací pokoj termostat', { area: livingRoom.id, device: lrThermostat.id }),
  motion(FX, 'Obývací pokoj pohyb', { area: livingRoom.id }),
  occupancy(FX, 'Obývací pokoj obsazenost gauče', { area: livingRoom.id }),
  registryEntry(FX, 'sensor', 'Hue Bridge ZigBee kanál', {
    area: livingRoom.id,
    device: lrHue.id,
    entityCategory: 'diagnostic',
  }),
  registryEntry(FX, 'sensor', 'Hue Bridge síťový kanál', {
    area: livingRoom.id,
    device: lrHue.id,
    entityCategory: 'diagnostic',
  }),
  registryEntry(FX, 'sensor', 'Tado baterie obývák', {
    area: livingRoom.id,
    device: lrThermostat.id,
    entityCategory: 'diagnostic',
  }),
  registryEntry(FX, 'sensor', 'Aqara baterie obývák', {
    area: livingRoom.id,
    device: lrAqara.id,
    entityCategory: 'diagnostic',
  }),
  light(FX, 'Obývací pokoj nálada', { area: livingRoom.id, device: lrHue.id }),
  switch_(FX, 'Obývací pokoj ventilátor', { area: livingRoom.id }),
  switch_(FX, 'Obývací pokoj zvlhčovač', { area: livingRoom.id }),
  registryEntry(FX, 'sensor', 'Obývací pokoj jas', { area: livingRoom.id }),
  registryEntry(FX, 'sensor', 'Obývací pokoj CO2', { area: livingRoom.id }),
]

const kitchenEntities = [
  light(FX, 'Kuchyně stropní světlo', { area: kitchen.id, device: kitchenHue.id }),
  light(FX, 'Kuchyně linka', { area: kitchen.id, device: kitchenHue.id }),
  light(FX, 'Kuchyně závěsné světlo', { area: kitchen.id, device: kitchenHue.id }),
  switch_(FX, 'Kuchyně varná konvice', { area: kitchen.id }),
  switch_(FX, 'Kuchyně kávovar', { area: kitchen.id }),
  switch_(FX, 'Kuchyně myčka', { area: kitchen.id }),
  switch_(FX, 'Kuchyně topinkovač', { area: kitchen.id }),
  switch_(FX, 'Kuchyně lednice', { area: kitchen.id }),
  tempSensor(FX, 'Kuchyně teplota', { area: kitchen.id, device: kitchenAqara.id }),
  humiditySensor(FX, 'Kuchyně vlhkost', { area: kitchen.id, device: kitchenAqara.id }),
  motion(FX, 'Kuchyně pohyb', { area: kitchen.id }),
  occupancy(FX, 'Kuchyně obsazenost dřezu', { area: kitchen.id }),
  tempSensor(FX, 'Kuchyně teplota lednice', { area: kitchen.id }),
  tempSensor(FX, 'Kuchyně teplota mrazáku', { area: kitchen.id }),
  registryEntry(FX, 'sensor', 'Kuchyně jas', { area: kitchen.id }),
  registryEntry(FX, 'sensor', 'Aqara baterie kuchyně', {
    area: kitchen.id,
    device: kitchenAqara.id,
    entityCategory: 'diagnostic',
  }),
  registryEntry(FX, 'sensor', 'Kuchyně CO2', { area: kitchen.id }),
  switch_(FX, 'Kuchyně digestoř', { area: kitchen.id }),
]

const bathroomEntities = [
  light(FX, 'Koupelna stropní světlo', { area: bathroom.id, device: bathHue.id }),
  light(FX, 'Koupelna zrcadlo', { area: bathroom.id, device: bathHue.id }),
  motion(FX, 'Koupelna pohyb', { area: bathroom.id }),
  occupancy(FX, 'Koupelna obsazenost sprchy', { area: bathroom.id }),
  tempSensor(FX, 'Koupelna teplota', { area: bathroom.id, device: bathAqara.id }),
  humiditySensor(FX, 'Koupelna vlhkost', { area: bathroom.id, device: bathAqara.id }),
  switch_(FX, 'Koupelna ventilátor', { area: bathroom.id }),
  switch_(FX, 'Koupelna topný žebřík', { area: bathroom.id }),
  registryEntry(FX, 'sensor', 'Aqara baterie koupelna', {
    area: bathroom.id,
    device: bathAqara.id,
    entityCategory: 'diagnostic',
  }),
  humiditySensor(FX, 'Koupelna pára vlhkost', { area: bathroom.id }),
]

const bedroomEntities = [
  light(FX, 'Ložnice stropní světlo', { area: bedroom.id, device: bedHue.id }),
  light(FX, 'Ložnice noční stolek vlevo', { area: bedroom.id, device: bedHue.id }),
  light(FX, 'Ložnice noční stolek vpravo', { area: bedroom.id, device: bedHue.id }),
  light(FX, 'Ložnice čtecí lampa', { area: bedroom.id, device: bedHue.id }),
  climate(FX, 'Ložnice termostat', { area: bedroom.id, device: bedThermostat.id }),
  motion(FX, 'Ložnice pohyb', { area: bedroom.id }),
  occupancy(FX, 'Ložnice obsazenost postele', { area: bedroom.id }),
  tempSensor(FX, 'Ložnice teplota', { area: bedroom.id }),
  humiditySensor(FX, 'Ložnice vlhkost', { area: bedroom.id }),
  light(FX, 'Ložnice nálada světlo', { area: bedroom.id, device: bedHue.id }),
  switch_(FX, 'Ložnice zvlhčovač', { area: bedroom.id }),
  switch_(FX, 'Ložnice ventilátor', { area: bedroom.id }),
  tempSensor(FX, 'Ložnice teplota u postele', { area: bedroom.id }),
  registryEntry(FX, 'sensor', 'Tado baterie ložnice', {
    area: bedroom.id,
    device: bedThermostat.id,
    entityCategory: 'diagnostic',
  }),
  registryEntry(FX, 'sensor', 'Tado signál ložnice', {
    area: bedroom.id,
    device: bedThermostat.id,
    entityCategory: 'diagnostic',
  }),
  registryEntry(FX, 'sensor', 'Ložnice jas', { area: bedroom.id }),
  registryEntry(FX, 'sensor', 'Ložnice CO2', { area: bedroom.id }),
  motion(FX, 'Ložnice pohyb u skříně', { area: bedroom.id }),
]

const officeEntities = [
  light(FX, 'Kancelář stropní světlo', { area: office.id, device: officeHue.id }),
  light(FX, 'Kancelář stolní lampa', { area: office.id, device: officeHue.id }),
  light(FX, 'Kancelář knihovna světlo', { area: office.id, device: officeHue.id }),
  switch_(FX, 'Kancelář zásuvka PC', { area: office.id }),
  switch_(FX, 'Kancelář zásuvka monitor', { area: office.id }),
  switch_(FX, 'Kancelář 3D tiskárna', { area: office.id }),
  tempSensor(FX, 'Kancelář teplota', { area: office.id }),
  humiditySensor(FX, 'Kancelář vlhkost', { area: office.id }),
  motion(FX, 'Kancelář pohyb', { area: office.id }),
  occupancy(FX, 'Kancelář obsazenost židle', { area: office.id }),
  tempSensor(FX, 'Kancelář teplota serveru', { area: office.id }),
  registryEntry(FX, 'sensor', 'Kancelář jas', { area: office.id }),
]

export const czechTidy = fixture({
  meta: {
    name: 'czech-tidy',
    description:
      '~80 entities across 5 well-set-up Czech rooms (Obývací pokoj, Kuchyně, ' +
      'Koupelna, Ložnice, Kancelář) on 2 floors. 100% area-attributed; no hidden, ' +
      'disabled, or ambiguous-named entries. Contrast fixture for the analyzer ' +
      'when english-cluttered exercises the messy-input paths.',
  },
  floors: [ground, upstairs],
  areas: [livingRoom, kitchen, bathroom, bedroom, office],
  devices: [
    lrHue,
    lrAqara,
    lrThermostat,
    kitchenHue,
    kitchenAqara,
    bathHue,
    bathAqara,
    bedHue,
    bedThermostat,
    officeHue,
  ],
  entities: [
    ...livingRoomEntities,
    ...kitchenEntities,
    ...bathroomEntities,
    ...bedroomEntities,
    ...officeEntities,
  ],
})
