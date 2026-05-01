import {
  area,
  device,
  fixture,
  floor,
  humiditySensor,
  light,
  motion,
  registryEntry,
  tempSensor,
} from './_builder/index.js'

const FX = 'vacuum-heavy'

const ground = floor('Ground', { level: 0, icon: 'mdi:home-floor-g' })

const livingRoom = area('Living Room', { floor: ground.id, icon: 'mdi:sofa' })
const kitchen = area('Kitchen', { floor: ground.id, icon: 'mdi:silverware-fork-knife' })
const hallway = area('Hallway', { floor: ground.id, icon: 'mdi:door' })

const lrIRobot = device('Living Room iRobot', { manufacturer: 'iRobot', area: livingRoom.id })
const lrEcovacs = device('Living Room Ecovacs', { manufacturer: 'Ecovacs', area: livingRoom.id })
const lrHue = device('Living Room Hue', { manufacturer: 'Philips', area: livingRoom.id })

const kitchenRoborock = device('Kitchen Roborock', { manufacturer: 'Roborock', area: kitchen.id })
const kitchenHue = device('Kitchen Hue', { manufacturer: 'Philips', area: kitchen.id })

const hallwayDreame = device('Hallway Dreame', { manufacturer: 'Dreame', area: hallway.id })
const hallwayHue = device('Hallway Hue', { manufacturer: 'Philips', area: hallway.id })

const livingRoomEntities = [
  registryEntry(FX, 'vacuum', 'Living Room Roomba', {
    area: livingRoom.id,
    device: lrIRobot.id,
  }),
  registryEntry(FX, 'vacuum', 'Living Room Mop Bot', {
    area: livingRoom.id,
    device: lrEcovacs.id,
  }),
  motion(FX, 'Living Room Motion', { area: livingRoom.id }),
  light(FX, 'Living Room Ceiling Light', { area: livingRoom.id, device: lrHue.id }),
  light(FX, 'Living Room Floor Lamp', { area: livingRoom.id, device: lrHue.id }),
  tempSensor(FX, 'Living Room Temperature', { area: livingRoom.id }),
]

const kitchenEntities = [
  registryEntry(FX, 'vacuum', 'Kitchen Robot K7', { area: kitchen.id, device: kitchenRoborock.id }),
  light(FX, 'Kitchen Ceiling Light', { area: kitchen.id, device: kitchenHue.id }),
  light(FX, 'Kitchen Counter Light', { area: kitchen.id, device: kitchenHue.id }),
  motion(FX, 'Kitchen Motion', { area: kitchen.id }),
  tempSensor(FX, 'Kitchen Temperature', { area: kitchen.id }),
  humiditySensor(FX, 'Kitchen Humidity', { area: kitchen.id }),
]

const hallwayEntities = [
  registryEntry(FX, 'vacuum', 'Hallway Mini Bot', { area: hallway.id, device: hallwayDreame.id }),
  motion(FX, 'Hallway Motion 1', { area: hallway.id }),
  motion(FX, 'Hallway Motion 2', { area: hallway.id }),
  light(FX, 'Hallway Light', { area: hallway.id, device: hallwayHue.id }),
]

const floatingEntities = [
  registryEntry(FX, 'sensor', 'Dreame Battery', { entityCategory: 'diagnostic' }),
  registryEntry(FX, 'sensor', 'Ecovacs Battery', { entityCategory: 'diagnostic' }),
  registryEntry(FX, 'sensor', 'Ecovacs Mop Status', { entityCategory: 'diagnostic' }),
  registryEntry(FX, 'sensor', 'Roborock Battery', { entityCategory: 'diagnostic' }),
  registryEntry(FX, 'sensor', 'Roborock Cleaning Time', { entityCategory: 'diagnostic' }),
  registryEntry(FX, 'sensor', 'Roomba Battery', { entityCategory: 'diagnostic' }),
  registryEntry(FX, 'sensor', 'Roomba Error Count', { entityCategory: 'diagnostic' }),
  registryEntry(FX, 'sensor', 'Old Vacuum Battery 1', { hidden: true }),
  registryEntry(FX, 'sensor', 'Old Vacuum Battery 2', { hidden: true }),
]

export const vacuumHeavy = fixture({
  meta: {
    name: 'vacuum-heavy',
    description:
      '~25 entities across Living Room, Kitchen, Hallway with 4 vacuum ' +
      'entities (Roomba, mop bot, Roborock, Dreame mini). 7 floating ' +
      'diagnostic battery + status sensors and 2 hidden legacy battery ' +
      'sensors round it out. Validates vacuum → vacuum group routing and ' +
      'that diagnostic + hidden vacuum sensors stay out of the visible ' +
      'grouping output.',
  },
  floors: [ground],
  areas: [livingRoom, kitchen, hallway],
  devices: [lrIRobot, lrEcovacs, lrHue, kitchenRoborock, kitchenHue, hallwayDreame, hallwayHue],
  entities: [...livingRoomEntities, ...kitchenEntities, ...hallwayEntities, ...floatingEntities],
})
