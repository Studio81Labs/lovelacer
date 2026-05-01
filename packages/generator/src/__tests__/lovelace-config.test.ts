import { describe, it, expect } from 'vitest'
import { buildLovelaceConfig, type BuildLovelaceConfigInput } from '../lovelace-config.js'
import type { HomeView } from '../home-view.js'
import type { RoomView } from '../lovelace-types.js'

const home: HomeView = {
  type: 'sections',
  title: 'Home',
  path: 'home',
  icon: 'mdi:home-variant',
  sections: [],
}

function room(title: string, path: string): RoomView {
  return {
    type: 'sections',
    title,
    path,
    icon: 'mdi:home',
    sections: [],
  }
}

describe('buildLovelaceConfig — title and shape', () => {
  it('uses the literal title "Lovelacer — Home" (em dash)', () => {
    const result = buildLovelaceConfig({ home, rooms: [] })
    expect(result.title).toBe('Lovelacer — Home')
  })

  it('produces { title, views } shape', () => {
    const result = buildLovelaceConfig({ home, rooms: [] })
    expect(Object.keys(result).sort()).toEqual(['title', 'views'])
  })
})

describe('buildLovelaceConfig — view ordering', () => {
  it('home view comes first when no rooms', () => {
    const result = buildLovelaceConfig({ home, rooms: [] })
    expect(result.views).toEqual([home])
  })

  it('home first, rooms alphabetical by title', () => {
    const input: BuildLovelaceConfigInput = {
      home,
      rooms: [
        room('Living Room', 'living_room'),
        room('Bedroom', 'bedroom'),
        room('Kitchen', 'kitchen'),
      ],
    }
    const result = buildLovelaceConfig(input)
    expect(result.views.map((v) => v.title)).toEqual(['Home', 'Bedroom', 'Kitchen', 'Living Room'])
  })

  it('alphabetical sort is case-insensitive (localeCompare default)', () => {
    const result = buildLovelaceConfig({
      home,
      rooms: [room('zen', 'a'), room('Apple', 'b'), room('banana', 'c')],
    })
    expect(result.views.map((v) => v.title).slice(1)).toEqual(['Apple', 'banana', 'zen'])
  })

  it('uses English locale for sort (Ž sorts after Z)', () => {
    const result = buildLovelaceConfig({
      home,
      rooms: [room('Žofie', 'a'), room('Anička', 'b')],
    })
    expect(result.views.map((v) => v.title).slice(1)).toEqual(['Anička', 'Žofie'])
  })
})

describe('buildLovelaceConfig — purity', () => {
  it('does not mutate the input rooms array', () => {
    const rooms = [room('Z', 'z'), room('A', 'a')]
    const before = rooms.map((r) => r.title)
    buildLovelaceConfig({ home, rooms })
    expect(rooms.map((r) => r.title)).toEqual(before)
  })

  it('same input → identical output (referentially-stable wrt input)', () => {
    const input: BuildLovelaceConfigInput = {
      home,
      rooms: [room('B', 'b'), room('A', 'a')],
    }
    const a = buildLovelaceConfig(input)
    const b = buildLovelaceConfig(input)
    expect(a).toEqual(b)
  })
})

describe('buildLovelaceConfig — view typing', () => {
  it('home view retained at index 0 with full HomeView fields', () => {
    const result = buildLovelaceConfig({ home, rooms: [] })
    const first = result.views[0]!
    expect(first.path).toBe('home')
    expect(first.icon).toBe('mdi:home-variant')
  })
})
