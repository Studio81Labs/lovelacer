import {
  area,
  device,
  door,
  fixture,
  floor,
  light,
  motion,
  occupancy,
  registryEntry,
} from './_builder/index.js'

const FX = 'security-rich'

const ground = floor('Ground', { level: 0, icon: 'mdi:home-floor-g' })

const frontEntry = area('Front Entry', { floor: ground.id, icon: 'mdi:door' })
const backYard = area('Back Yard', { floor: ground.id, icon: 'mdi:flower-tulip' })
const garage = area('Garage', { floor: ground.id, icon: 'mdi:garage-variant' })
const hallway = area('Hallway', { floor: ground.id, icon: 'mdi:door' })

const frontHue = device('Front Entry Hue', { manufacturer: 'Philips', area: frontEntry.id })
const frontSchlage = device('Front Door Schlage', { manufacturer: 'Schlage', area: frontEntry.id })
const frontReolink = device('Front Door Reolink', { manufacturer: 'Reolink', area: frontEntry.id })

const backReolink = device('Back Yard Reolink', { manufacturer: 'Reolink', area: backYard.id })
const backHue = device('Back Yard Hue', { manufacturer: 'Philips', area: backYard.id })

const garageSchlage = device('Garage Schlage', { manufacturer: 'Schlage', area: garage.id })
const garageReolink = device('Garage Reolink', { manufacturer: 'Reolink', area: garage.id })
const garageOpener = device('Garage Door Opener', { manufacturer: 'Chamberlain', area: garage.id })

const hallwayHue = device('Hallway Hue', { manufacturer: 'Philips', area: hallway.id })

const perimeterReolink1 = device('Perimeter Reolink 1', { manufacturer: 'Reolink' })
const perimeterReolink2 = device('Perimeter Reolink 2', { manufacturer: 'Reolink' })

const frontEntryEntities = [
  registryEntry(FX, 'lock', 'Front Door Lock', { area: frontEntry.id, device: frontSchlage.id }),
  registryEntry(FX, 'camera', 'Front Door Camera', {
    area: frontEntry.id,
    device: frontReolink.id,
  }),
  motion(FX, 'Front Entry Motion', { area: frontEntry.id }),
  door(FX, 'Front Door Sensor', { area: frontEntry.id }),
  light(FX, 'Front Porch Light', { area: frontEntry.id, device: frontHue.id }),
  occupancy(FX, 'Front Doorbell', { area: frontEntry.id }),
]

const backYardEntities = [
  registryEntry(FX, 'camera', 'Back Yard Camera North', {
    area: backYard.id,
    device: backReolink.id,
  }),
  registryEntry(FX, 'camera', 'Back Yard Camera South', {
    area: backYard.id,
    device: backReolink.id,
  }),
  motion(FX, 'Back Yard Motion North', { area: backYard.id }),
  motion(FX, 'Back Yard Motion South', { area: backYard.id }),
  light(FX, 'Back Yard Flood Light 1', { area: backYard.id, device: backHue.id }),
  light(FX, 'Back Yard Flood Light 2', { area: backYard.id, device: backHue.id }),
  door(FX, 'Back Yard Gate', { area: backYard.id }),
]

const garageEntities = [
  registryEntry(FX, 'lock', 'Garage Side Door Lock', { area: garage.id, device: garageSchlage.id }),
  registryEntry(FX, 'camera', 'Garage Camera', { area: garage.id, device: garageReolink.id }),
  motion(FX, 'Garage Motion', { area: garage.id }),
  registryEntry(FX, 'cover', 'Garage Door', { area: garage.id, device: garageOpener.id }),
  light(FX, 'Garage Light', { area: garage.id }),
]

const hallwayEntities = [
  motion(FX, 'Hallway Motion 1', { area: hallway.id }),
  motion(FX, 'Hallway Motion 2', { area: hallway.id }),
  registryEntry(FX, 'binary_sensor', 'Hallway Smoke Sensor', { area: hallway.id }),
  light(FX, 'Hallway Light', { area: hallway.id, device: hallwayHue.id }),
  door(FX, 'Hallway Side Door', { area: hallway.id }),
  light(FX, 'Hallway Night Light', { area: hallway.id, device: hallwayHue.id }),
]

const floatingEntities = [
  registryEntry(FX, 'camera', 'Perimeter Camera North', { device: perimeterReolink1.id }),
  registryEntry(FX, 'camera', 'Perimeter Camera South', { device: perimeterReolink1.id }),
  registryEntry(FX, 'camera', 'Perimeter Camera East', { device: perimeterReolink2.id }),
  registryEntry(FX, 'camera', 'Perimeter Camera West', { device: perimeterReolink2.id }),
  motion(FX, 'Old PIR Sensor 1', { hidden: true }),
  motion(FX, 'Old PIR Sensor 2', { disabled: true }),
]

export const securityRich = fixture({
  meta: {
    name: 'security-rich',
    description:
      '~30 entities across 4 areas (Front Entry, Back Yard, Garage, ' +
      'Hallway). Security-themed install with locks, cameras, motion + door ' +
      'sensors, plus 4 perimeter cameras with no area_id. Validates the new ' +
      'lock → security and camera → cameras card mappings, and exercises ' +
      'multiple cameras within a single area.',
  },
  floors: [ground],
  areas: [frontEntry, backYard, garage, hallway],
  devices: [
    frontHue,
    frontSchlage,
    frontReolink,
    backReolink,
    backHue,
    garageSchlage,
    garageReolink,
    garageOpener,
    hallwayHue,
    perimeterReolink1,
    perimeterReolink2,
  ],
  entities: [
    ...frontEntryEntities,
    ...backYardEntities,
    ...garageEntities,
    ...hallwayEntities,
    ...floatingEntities,
  ],
})
