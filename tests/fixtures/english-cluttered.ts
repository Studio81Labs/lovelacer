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

const FX = 'english-cluttered'

const ground = floor('Ground', { level: 0, icon: 'mdi:home-floor-g' })
const upstairs = floor('Upstairs', { level: 1, icon: 'mdi:home-floor-1' })

const livingRoom = area('Living Room', { floor: ground.id, icon: 'mdi:sofa' })
const kitchen = area('Kitchen', { floor: ground.id, icon: 'mdi:silverware-fork-knife' })
const bathroom = area('Bathroom', { floor: ground.id, icon: 'mdi:shower' })
const bedroom = area('Bedroom', { floor: upstairs.id, icon: 'mdi:bed' })
const office = area('Office', { floor: upstairs.id, icon: 'mdi:desk' })
const garage = area('Garage', { floor: ground.id, icon: 'mdi:garage' })

// ── Devices ─────────────────────────────────────────────────────────────
// "Direct" devices: anchored in an area; their entities will mostly inherit.
const lrHueBridge = device('Living Room Hue Bridge', {
  manufacturer: 'Philips',
  model: 'BSB002',
  area: livingRoom.id,
})
const lrAqara = device('Living Room Aqara TH', {
  manufacturer: 'Aqara',
  model: 'WSDCGQ11LM',
  area: livingRoom.id,
})
const lrThermostat = device('Living Room Tado', {
  manufacturer: 'tado',
  model: 'V3+',
  area: livingRoom.id,
})
const lrTV = device('Living Room TV', { manufacturer: 'LG', model: 'OLED55C2', area: livingRoom.id })

const kitchenHue = device('Kitchen Hue', { manufacturer: 'Philips', area: kitchen.id })
const kitchenAqara = device('Kitchen Aqara TH', {
  manufacturer: 'Aqara',
  model: 'WSDCGQ11LM',
  area: kitchen.id,
})
const dishwasher = device('Dishwasher Plug', {
  manufacturer: 'Shelly',
  model: 'Plug S',
  area: kitchen.id,
})

const bathHue = device('Bathroom Hue', { manufacturer: 'Philips', area: bathroom.id })
const bathAqara = device('Bathroom Aqara TH', { manufacturer: 'Aqara', area: bathroom.id })

const bedHue = device('Bedroom Hue', { manufacturer: 'Philips', area: bedroom.id })
const bedThermostat = device('Bedroom Tado', { manufacturer: 'tado', area: bedroom.id })

const officeHue = device('Office Hue', { manufacturer: 'Philips', area: office.id })
const officePlug = device('Office Plug', { manufacturer: 'Shelly', area: office.id })

const garageDoor = device('Garage Door Sensor', { manufacturer: 'Aqara', area: garage.id })
const garageMotion = device('Garage Motion', { manufacturer: 'Aqara', area: garage.id })

// "Device-only" devices: have area_id, but their entities will NOT (forces
// device→entity propagation in the analyzer).
const kitchenZ2M = device('Kitchen Zigbee Group', { area: kitchen.id })
const lrZ2M = device('Living Room Zigbee Group', { area: livingRoom.id })
const bedZ2M = device('Bedroom Zigbee Group', { area: bedroom.id })
const officeZ2M = device('Office Zigbee Group', { area: office.id })

// "Floating" devices: no area at all — entities will need friendly-name fallback.
const espHallway = device('ESP32 Hallway')
const espStairs = device('ESP32 Stairs')
const espOutdoor = device('ESP32 Outdoor')
const networkSwitch = device('UniFi Switch', { manufacturer: 'Ubiquiti' })
const router = device('UniFi Router', { manufacturer: 'Ubiquiti' })

// ── Entities ────────────────────────────────────────────────────────────
// Counts per room are approximate; the self-tests assert distributional
// properties rather than exact totals.

const livingRoomEntities = [
  // direct area_id (clean)
  light(FX, 'Living Room Ceiling', { area: livingRoom.id, device: lrHueBridge.id }),
  light(FX, 'Living Room Lamp Left', { area: livingRoom.id, device: lrHueBridge.id }),
  light(FX, 'Living Room Lamp Right', { area: livingRoom.id, device: lrHueBridge.id }),
  light(FX, 'Living Room Spot 1', { area: livingRoom.id, device: lrHueBridge.id }),
  light(FX, 'Living Room Spot 2', { area: livingRoom.id, device: lrHueBridge.id }),
  light(FX, 'Living Room Spot 3', { area: livingRoom.id, device: lrHueBridge.id }),
  tempSensor(FX, 'Living Room Temperature', { area: livingRoom.id, device: lrAqara.id }),
  humiditySensor(FX, 'Living Room Humidity', { area: livingRoom.id, device: lrAqara.id }),
  climate(FX, 'Living Room Thermostat', { area: livingRoom.id, device: lrThermostat.id }),
  registryEntry(FX, 'media_player', 'Living Room TV', { area: livingRoom.id, device: lrTV.id }),
  switch_(FX, 'Living Room Floor Heating', { area: livingRoom.id }),
  // device-only (no entity area_id)
  motion(FX, 'Couch Presence', { device: lrZ2M.id }),
  occupancy(FX, 'Sofa Occupancy', { device: lrZ2M.id }),
  tempSensor(FX, 'Couch Temp', { device: lrZ2M.id, nameByUser: 'Sofa Side Temperature' }),
  humiditySensor(FX, 'Couch Humidity', { device: lrZ2M.id }),
  motion(FX, 'Living Room Window Motion', { device: lrZ2M.id }),
  occupancy(FX, 'Armchair Occupancy', { device: lrZ2M.id }),
  // ambiguous friendly names
  tempSensor(FX, '0x158d000111aaa Temperature', { device: lrZ2M.id }),
  humiditySensor(FX, '0x158d000111aaa Humidity', { device: lrZ2M.id }),
  // diagnostics — should be filtered
  registryEntry(FX, 'sensor', 'Hue Bridge ZigBee Channel', {
    device: lrHueBridge.id,
    entityCategory: 'diagnostic',
  }),
  registryEntry(FX, 'sensor', 'Hue Bridge Software Version', {
    device: lrHueBridge.id,
    entityCategory: 'diagnostic',
  }),
  // hidden by user
  light(FX, 'Living Room Closet', {
    area: livingRoom.id,
    device: lrHueBridge.id,
    hidden: true,
  }),
  // disabled
  light(FX, 'Living Room Old Lamp', {
    area: livingRoom.id,
    device: lrHueBridge.id,
    disabled: true,
  }),
  // straddling friendly name
  motion(FX, 'Hallway / Living Room Motion'),
]

const kitchenEntities = [
  light(FX, 'Kitchen Ceiling', { area: kitchen.id, device: kitchenHue.id }),
  light(FX, 'Kitchen Counter Strip', { area: kitchen.id, device: kitchenHue.id }),
  light(FX, 'Kitchen Pendant', { area: kitchen.id, device: kitchenHue.id }),
  switch_(FX, 'Kettle', { area: kitchen.id }),
  switch_(FX, 'Coffee Machine', { area: kitchen.id }),
  switch_(FX, 'Dishwasher Plug', { area: kitchen.id, device: dishwasher.id }),
  switch_(FX, 'Toaster', { area: kitchen.id }),
  tempSensor(FX, 'Kitchen Temperature', { area: kitchen.id, device: kitchenAqara.id }),
  humiditySensor(FX, 'Kitchen Humidity', { area: kitchen.id, device: kitchenAqara.id }),
  motion(FX, 'Kitchen Motion', { area: kitchen.id }),
  // device-only
  occupancy(FX, 'Sink Occupancy', { device: kitchenZ2M.id }),
  tempSensor(FX, 'Fridge Temp', { device: kitchenZ2M.id }),
  tempSensor(FX, 'Freezer Temp', { device: kitchenZ2M.id }),
  humiditySensor(FX, 'Kitchen Counter Humidity', { device: kitchenZ2M.id }),
  motion(FX, 'Kitchen Window Motion', { device: kitchenZ2M.id }),
  occupancy(FX, 'Kitchen Table Occupancy', { device: kitchenZ2M.id }),
  // ambiguous
  tempSensor(FX, 'Sensor 4', { device: kitchenZ2M.id }),
  registryEntry(FX, 'sensor', 'Aqara Battery 158d', {
    device: kitchenAqara.id,
    entityCategory: 'diagnostic',
  }),
  // P1b registry-only domain
  registryEntry(FX, 'cover', 'Kitchen Blinds', { area: kitchen.id }),
]

const bathroomEntities = [
  light(FX, 'Bathroom Ceiling', { area: bathroom.id, device: bathHue.id }),
  light(FX, 'Bathroom Mirror', { area: bathroom.id, device: bathHue.id }),
  motion(FX, 'Bathroom Motion', { area: bathroom.id }),
  occupancy(FX, 'Shower Occupancy', { area: bathroom.id }),
  tempSensor(FX, 'Bathroom Temperature', { area: bathroom.id, device: bathAqara.id }),
  humiditySensor(FX, 'Bathroom Humidity', { area: bathroom.id, device: bathAqara.id }),
  switch_(FX, 'Bathroom Fan', { area: bathroom.id }),
  switch_(FX, 'Towel Rail Heater', { area: bathroom.id }),
  registryEntry(FX, 'sensor', 'Bathroom Aqara Battery', {
    device: bathAqara.id,
    entityCategory: 'diagnostic',
  }),
  humiditySensor(FX, 'Bathroom Steam Sensor', {
    area: bathroom.id,
    nameByUser: 'Steam Trigger',
  }),
  light(FX, 'Bathroom Night Light', { area: bathroom.id, device: bathHue.id, hidden: true }),
  motion(FX, 'Bathroom Old Motion', { area: bathroom.id, disabled: true }),
]

const bedroomEntities = [
  light(FX, 'Bedroom Ceiling', { area: bedroom.id, device: bedHue.id }),
  light(FX, 'Bedroom Bedside Left', { area: bedroom.id, device: bedHue.id }),
  light(FX, 'Bedroom Bedside Right', { area: bedroom.id, device: bedHue.id }),
  light(FX, 'Bedroom Reading Lamp', { area: bedroom.id, device: bedHue.id }),
  climate(FX, 'Bedroom Thermostat', { area: bedroom.id, device: bedThermostat.id }),
  motion(FX, 'Bedroom Motion', { area: bedroom.id }),
  tempSensor(FX, 'Bedroom Temperature', { area: bedroom.id }),
  humiditySensor(FX, 'Bedroom Humidity', { area: bedroom.id }),
  // device-only
  motion(FX, 'Bed Presence', { device: bedZ2M.id }),
  occupancy(FX, 'Wardrobe Occupancy', { device: bedZ2M.id }),
  tempSensor(FX, 'Bed Side Temperature', { device: bedZ2M.id }),
  humiditySensor(FX, 'Wardrobe Humidity', { device: bedZ2M.id }),
  motion(FX, 'Bedroom Door Motion', { device: bedZ2M.id }),
  occupancy(FX, 'Bedroom Window Occupancy', { device: bedZ2M.id }),
  // ambiguous + diagnostic
  registryEntry(FX, 'sensor', 'Tado V3+ Battery', {
    device: bedThermostat.id,
    entityCategory: 'diagnostic',
  }),
  registryEntry(FX, 'sensor', 'Tado V3+ Signal Strength', {
    device: bedThermostat.id,
    entityCategory: 'diagnostic',
  }),
]

const officeEntities = [
  light(FX, 'Office Ceiling', { area: office.id, device: officeHue.id }),
  light(FX, 'Office Desk Lamp', { area: office.id, device: officeHue.id }),
  light(FX, 'Office Bookshelf', { area: office.id, device: officeHue.id }),
  switch_(FX, 'Office Plug', { area: office.id, device: officePlug.id }),
  switch_(FX, 'Monitor Plug', { area: office.id }),
  switch_(FX, '3D Printer Plug', { area: office.id }),
  tempSensor(FX, 'Office Temperature', { area: office.id }),
  humiditySensor(FX, 'Office Humidity', { area: office.id }),
  // device-only
  motion(FX, 'Desk Presence', { device: officeZ2M.id }),
  occupancy(FX, 'Chair Occupancy', { device: officeZ2M.id }),
  tempSensor(FX, 'Server Rack Temp', { device: officeZ2M.id }),
  humiditySensor(FX, 'Office Corner Humidity', { device: officeZ2M.id }),
  motion(FX, 'Office Door Motion', { device: officeZ2M.id }),
  occupancy(FX, 'Couch Office Occupancy', { device: officeZ2M.id }),
  // diagnostic + name_by_user
  registryEntry(FX, 'sensor', 'Shelly Plug Power', {
    device: officePlug.id,
    nameByUser: 'Office PC Power',
  }),
  registryEntry(FX, 'sensor', 'Shelly Plug RSSI', {
    device: officePlug.id,
    entityCategory: 'diagnostic',
  }),
  registryEntry(FX, 'sensor', 'Shelly Plug Energy Today', {
    device: officePlug.id,
    entityCategory: 'diagnostic',
  }),
]

const garageEntities = [
  door(FX, 'Garage Door', { area: garage.id, device: garageDoor.id }),
  motion(FX, 'Garage Motion', { area: garage.id, device: garageMotion.id }),
  switch_(FX, 'Garage Light Switch', { area: garage.id }),
  light(FX, 'Garage Ceiling', { area: garage.id }),
  tempSensor(FX, 'Garage Temperature', { area: garage.id }),
  humiditySensor(FX, 'Garage Humidity', { area: garage.id }),
  registryEntry(FX, 'cover', 'Garage Door Opener', { area: garage.id, device: garageDoor.id }),
  registryEntry(FX, 'lock', 'Garage Side Door Lock', { area: garage.id }),
  switch_(FX, 'Garage Workbench Plug', { area: garage.id }),
  light(FX, 'Garage Workbench Light', { area: garage.id }),
  // diagnostics
  registryEntry(FX, 'sensor', 'Garage Aqara Battery', {
    device: garageDoor.id,
    entityCategory: 'diagnostic',
  }),
  registryEntry(FX, 'sensor', 'Garage Motion Battery', {
    device: garageMotion.id,
    entityCategory: 'diagnostic',
  }),
]

// Misc — entities with no usable area attribution. Some have names that
// the analyzer should recognize via friendly-name fallback (Hallway, Stairs,
// Outdoor); others are genuinely homeless (network gear, hub diagnostics).
const miscEntities = [
  motion(FX, 'Hallway Motion', { device: espHallway.id }),
  motion(FX, 'Hallway / Stairs Motion'),
  tempSensor(FX, 'Hallway Temperature', { device: espHallway.id }),
  humiditySensor(FX, 'Hallway Humidity', { device: espHallway.id }),
  motion(FX, 'Stairs Motion', { device: espStairs.id }),
  tempSensor(FX, 'Stairs Temperature', { device: espStairs.id }),
  tempSensor(FX, 'Outdoor Temperature', { device: espOutdoor.id }),
  humiditySensor(FX, 'Outdoor Humidity', { device: espOutdoor.id }),
  registryEntry(FX, 'sensor', 'Outdoor Wind Speed', { device: espOutdoor.id }),
  registryEntry(FX, 'sensor', 'Outdoor UV Index', { device: espOutdoor.id }),
  registryEntry(FX, 'sensor', 'Outdoor Rain Rate', { device: espOutdoor.id }),
  registryEntry(FX, 'sensor', 'UniFi Switch CPU', {
    device: networkSwitch.id,
    entityCategory: 'diagnostic',
  }),
  registryEntry(FX, 'sensor', 'UniFi Switch Memory', {
    device: networkSwitch.id,
    entityCategory: 'diagnostic',
  }),
  registryEntry(FX, 'sensor', 'UniFi Switch Uptime', {
    device: networkSwitch.id,
    entityCategory: 'diagnostic',
  }),
  registryEntry(FX, 'sensor', 'UniFi Router CPU', {
    device: router.id,
    entityCategory: 'diagnostic',
  }),
  registryEntry(FX, 'sensor', 'UniFi Router Memory', {
    device: router.id,
    entityCategory: 'diagnostic',
  }),
  registryEntry(FX, 'sensor', 'UniFi Router WAN Throughput', {
    device: router.id,
    entityCategory: 'diagnostic',
  }),
  registryEntry(FX, 'sensor', 'UniFi Router LAN Throughput', {
    device: router.id,
    entityCategory: 'diagnostic',
  }),
  // ambiguous floaters
  tempSensor(FX, 'Sensor 1'),
  tempSensor(FX, 'Sensor 2'),
  tempSensor(FX, 'Sensor 3'),
  humiditySensor(FX, 'Aqara TH 0x158d000999fff'),
  humiditySensor(FX, 'Aqara TH 0x158d000888eee'),
  // disabled floaters
  tempSensor(FX, 'Old Test Sensor', { disabled: true }),
  tempSensor(FX, 'Deprecated Sensor A', { disabled: true }),
  // hidden floaters
  registryEntry(FX, 'sensor', 'System Monitor Load', { hidden: true }),
  registryEntry(FX, 'sensor', 'System Monitor Memory', { hidden: true }),
  registryEntry(FX, 'sensor', 'System Monitor CPU Temp', { hidden: true }),
  registryEntry(FX, 'fan', 'Office Floor Fan'),
  registryEntry(FX, 'media_player', 'Bedroom Speaker'),
  registryEntry(FX, 'media_player', 'Kitchen Speaker'),
  registryEntry(FX, 'media_player', 'Living Room Echo'),
  registryEntry(FX, 'lock', 'Front Door Lock'),
  registryEntry(FX, 'cover', 'Hallway Curtains'),
  registryEntry(FX, 'cover', 'Bedroom Curtains'),
  // additional orphaned floaters to boost no-area pool
  tempSensor(FX, 'Attic Temperature'),
  humiditySensor(FX, 'Attic Humidity'),
  motion(FX, 'Attic Motion'),
  tempSensor(FX, 'Boiler Room Temperature'),
  humiditySensor(FX, 'Boiler Room Humidity'),
  switch_(FX, 'Water Heater Switch'),
  tempSensor(FX, 'Water Heater Temperature'),
  registryEntry(FX, 'sensor', 'Solar Panel Power'),
  registryEntry(FX, 'sensor', 'Solar Panel Energy Today'),
  registryEntry(FX, 'sensor', 'Grid Import Power'),
  registryEntry(FX, 'sensor', 'Grid Export Power'),
  registryEntry(FX, 'sensor', 'Battery State Of Charge'),
  registryEntry(FX, 'sensor', 'P1 Meter Gas'),
  registryEntry(FX, 'sensor', 'P1 Meter Power'),
  // More device-only via Z2M groups (adds to device-only pool, not orphaned)
  motion(FX, 'Living Room Window Motion LR', { device: lrZ2M.id }),
  occupancy(FX, 'Dining Table Occupancy', { device: lrZ2M.id }),
  motion(FX, 'Kitchen Back Door Motion', { device: kitchenZ2M.id }),
  tempSensor(FX, 'Kitchen Cabinet Temp', { device: kitchenZ2M.id }),
  motion(FX, 'Office Window Motion', { device: officeZ2M.id }),
  tempSensor(FX, 'Office Server Temp 2', { device: officeZ2M.id }),
  // device-only via area-having floating devices
  motion(FX, 'Bedroom Closet Motion', { device: bedZ2M.id }),
  humiditySensor(FX, 'Bedroom Closet Humidity', { device: bedZ2M.id }),
]

export const englishCluttered = fixture({
  meta: {
    name: 'english-cluttered',
    description:
      '~165 entities across 6 rooms with mixed area attribution, ambiguous names, ' +
      'diagnostics, hidden/disabled entries, and out-of-P1a-scope domains. ' +
      'Heuristic-stress fixture for analyzer development.',
  },
  floors: [ground, upstairs],
  areas: [livingRoom, kitchen, bathroom, bedroom, office, garage],
  devices: [
    lrHueBridge, lrAqara, lrThermostat, lrTV,
    kitchenHue, kitchenAqara, dishwasher,
    bathHue, bathAqara,
    bedHue, bedThermostat,
    officeHue, officePlug,
    garageDoor, garageMotion,
    kitchenZ2M, lrZ2M, bedZ2M, officeZ2M,
    espHallway, espStairs, espOutdoor, networkSwitch, router,
  ],
  entities: [
    ...livingRoomEntities,
    ...kitchenEntities,
    ...bathroomEntities,
    ...bedroomEntities,
    ...officeEntities,
    ...garageEntities,
    ...miscEntities,
  ],
})
