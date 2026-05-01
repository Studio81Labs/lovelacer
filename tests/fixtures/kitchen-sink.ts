import {
  area,
  device,
  fixture,
  floor,
  humiditySensor,
  light,
  motion,
  occupancy,
  registryEntry,
  tempSensor,
} from './_builder/index.js'

const FX = 'kitchen-sink'

const ground = floor('Ground', { level: 0, icon: 'mdi:home-floor-g' })

const livingRoom = area('Living Room', { floor: ground.id, icon: 'mdi:sofa' })
const masterBedroom = area('Master Bedroom', { floor: ground.id, icon: 'mdi:bed' })
const kitchen = area('Kitchen', { floor: ground.id, icon: 'mdi:silverware-fork-knife' })
const frontDoor = area('Front Door', { floor: ground.id, icon: 'mdi:door' })

const lrSamsung = device('Living Room Samsung TV', { manufacturer: 'Samsung', area: livingRoom.id })
const lrShelly = device('Living Room Shelly Blinds', { manufacturer: 'Shelly', area: livingRoom.id })
const lrReolink = device('Living Room Reolink', { manufacturer: 'Reolink', area: livingRoom.id })
const lrHue = device('Living Room Hue', { manufacturer: 'Philips', area: livingRoom.id })

const mbSonos = device('Master Bedroom Sonos', { manufacturer: 'Sonos', area: masterBedroom.id })
const mbShelly = device('Master Bedroom Shelly Blinds', {
  manufacturer: 'Shelly',
  area: masterBedroom.id,
})
const mbHue = device('Master Bedroom Hue', { manufacturer: 'Philips', area: masterBedroom.id })

const kRoborock = device('Kitchen Roborock', { manufacturer: 'Roborock', area: kitchen.id })
const kSonos = device('Kitchen Sonos', { manufacturer: 'Sonos', area: kitchen.id })
const kHue = device('Kitchen Hue', { manufacturer: 'Philips', area: kitchen.id })

const fdSchlage = device('Front Door Schlage', { manufacturer: 'Schlage', area: frontDoor.id })
const fdReolink = device('Front Door Reolink', { manufacturer: 'Reolink', area: frontDoor.id })
const fdHue = device('Front Door Hue', { manufacturer: 'Philips', area: frontDoor.id })

const livingRoomEntities = [
  registryEntry(FX, 'media_player', 'Living Room Samsung TV', {
    area: livingRoom.id,
    device: lrSamsung.id,
  }),
  registryEntry(FX, 'cover', 'Living Room Blinds', {
    area: livingRoom.id,
    device: lrShelly.id,
  }),
  registryEntry(FX, 'camera', 'Living Room Camera', {
    area: livingRoom.id,
    device: lrReolink.id,
  }),
  light(FX, 'Living Room Ceiling Light', { area: livingRoom.id, device: lrHue.id }),
  light(FX, 'Living Room Floor Lamp', { area: livingRoom.id, device: lrHue.id }),
  motion(FX, 'Living Room Motion', { area: livingRoom.id }),
  tempSensor(FX, 'Living Room Temperature', { area: livingRoom.id }),
]

const masterBedroomEntities = [
  registryEntry(FX, 'media_player', 'Master Bedroom Speaker', {
    area: masterBedroom.id,
    device: mbSonos.id,
  }),
  registryEntry(FX, 'cover', 'Master Bedroom Blackout Blinds', {
    area: masterBedroom.id,
    device: mbShelly.id,
  }),
  registryEntry(FX, 'fan', 'Master Bedroom Ceiling Fan', { area: masterBedroom.id }),
  light(FX, 'Master Bedroom Ceiling Light', { area: masterBedroom.id, device: mbHue.id }),
  light(FX, 'Master Bedroom Bedside Light', { area: masterBedroom.id, device: mbHue.id }),
  motion(FX, 'Master Bedroom Motion', { area: masterBedroom.id }),
]

const kitchenEntities = [
  registryEntry(FX, 'vacuum', 'Kitchen Roborock', { area: kitchen.id, device: kRoborock.id }),
  registryEntry(FX, 'fan', 'Kitchen Range Hood', { area: kitchen.id }),
  registryEntry(FX, 'media_player', 'Kitchen Sonos', { area: kitchen.id, device: kSonos.id }),
  light(FX, 'Kitchen Ceiling Light', { area: kitchen.id, device: kHue.id }),
  light(FX, 'Kitchen Counter Light', { area: kitchen.id, device: kHue.id }),
  tempSensor(FX, 'Kitchen Temperature', { area: kitchen.id }),
  humiditySensor(FX, 'Kitchen Humidity', { area: kitchen.id }),
]

const frontDoorEntities = [
  registryEntry(FX, 'lock', 'Front Door Lock', { area: frontDoor.id, device: fdSchlage.id }),
  registryEntry(FX, 'camera', 'Front Door Camera', { area: frontDoor.id, device: fdReolink.id }),
  occupancy(FX, 'Front Doorbell', { area: frontDoor.id }),
  light(FX, 'Front Porch Light', { area: frontDoor.id, device: fdHue.id }),
]

const floatingEntities = [
  registryEntry(FX, 'sensor', 'Hue Bridge Uptime', { entityCategory: 'diagnostic' }),
  registryEntry(FX, 'sensor', 'Sonos Connection Quality', { entityCategory: 'diagnostic' }),
  registryEntry(FX, 'sensor', 'Reolink Stream Bitrate', { entityCategory: 'diagnostic' }),
  registryEntry(FX, 'sensor', 'Roborock Battery', { entityCategory: 'diagnostic' }),
  registryEntry(FX, 'sensor', 'Hidden Battery 1', { hidden: true }),
  registryEntry(FX, 'sensor', 'Hidden Battery 2', { hidden: true }),
  registryEntry(FX, 'switch', 'Disabled Old Plug 1', { disabled: true }),
  registryEntry(FX, 'switch', 'Disabled Old Plug 2', { disabled: true }),
]

export const kitchenSink = fixture({
  meta: {
    name: 'kitchen-sink',
    description:
      '~32 entities across 4 areas. Smoke fixture for the full P1b-2 ' +
      'domain matrix: every new domain (cover, media_player, lock, camera, ' +
      'vacuum, fan) appears in at least one area. Validates that all 6 new ' +
      'card mappings work together in a single install.',
  },
  floors: [ground],
  areas: [livingRoom, masterBedroom, kitchen, frontDoor],
  devices: [
    lrSamsung,
    lrShelly,
    lrReolink,
    lrHue,
    mbSonos,
    mbShelly,
    mbHue,
    kRoborock,
    kSonos,
    kHue,
    fdSchlage,
    fdReolink,
    fdHue,
  ],
  entities: [
    ...livingRoomEntities,
    ...masterBedroomEntities,
    ...kitchenEntities,
    ...frontDoorEntities,
    ...floatingEntities,
  ],
})
