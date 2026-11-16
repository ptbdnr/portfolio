import { describe, expect, it } from 'vitest'
import { angleBetween, basis, dirToVec, groundMatrix, project, turn, unproject, vecToDir, wrap, type Camera } from './math.ts'

const cam = (o: Partial<Camera> = {}): Camera => ({ yaw: 0, pitch: 0, roll: 0, fov: 90, width: 1000, height: 500, ...o })

describe('directions', () => {
  it('wraps angles into (-180, 180]', () => {
    expect(wrap(190)).toBe(-170)
    expect(wrap(-190)).toBe(170)
    expect(wrap(180)).toBe(180)
    expect(wrap(-180)).toBe(180)
    expect(wrap(720 + 45)).toBe(45)
    expect(turn(170, -170)).toBe(20)
    expect(turn(-170, 170)).toBe(-20)
  })

  it('turns yaw and pitch into vectors and back', () => {
    expect(dirToVec(0, 0).map((v) => +v.toFixed(6) + 0)).toEqual([0, 0, -1])
    expect(dirToVec(90, 0).map((v) => +v.toFixed(6) + 0)).toEqual([1, 0, 0])
    expect(dirToVec(0, 90).map((v) => +v.toFixed(6) + 0)).toEqual([0, 1, 0])
    for (const [yaw, pitch] of [
      [37, 12],
      [-150, -40],
      [179, 80],
    ]) {
      const d = vecToDir(dirToVec(yaw, pitch))
      expect(d.yaw).toBeCloseTo(yaw, 6)
      expect(d.pitch).toBeCloseTo(pitch, 6)
    }
    expect(angleBetween({ yaw: 10, pitch: 0 }, { yaw: -10, pitch: 0 })).toBeCloseTo(20, 6)
  })
})

describe('the camera', () => {
  it('puts what you look at in the middle of the screen, and right is right', () => {
    const c = cam({ yaw: 30, pitch: 10 })
    const b = basis(c)
    const centre = project(b, c, { yaw: 30, pitch: 10 })
    expect(centre.x).toBeCloseTo(500, 6)
    expect(centre.y).toBeCloseTo(250, 6)
    expect(project(b, c, { yaw: 40, pitch: 10 }).x).toBeGreaterThan(500)
    expect(project(b, c, { yaw: 30, pitch: 20 }).y).toBeLessThan(250)
    expect(project(b, c, { yaw: 210, pitch: 0 }).visible).toBe(false)
  })

  it('spans the field of view across the wider side of the screen', () => {
    const c = cam({ fov: 90 })
    const b = basis(c)
    expect(project(b, c, { yaw: 45, pitch: 0 }).x).toBeCloseTo(1000, 4)
    const tall = cam({ fov: 90, width: 500, height: 1000 })
    expect(project(basis(tall), tall, { yaw: 0, pitch: 45 }).y).toBeCloseTo(0, 4)
  })

  it('finds the direction under a point on the screen (the inverse of projecting)', () => {
    const c = cam({ yaw: -120, pitch: -25, fov: 70 })
    const b = basis(c)
    for (const [x, y] of [
      [500, 250],
      [120, 400],
      [990, 10],
    ]) {
      const p = project(b, c, unproject(b, c, x, y))
      expect(p.x).toBeCloseTo(x, 4)
      expect(p.y).toBeCloseTo(y, 4)
    }
  })
})

describe('arrows on the ground', () => {
  it('maps an element onto the ground plane where the projection says', () => {
    const c = cam({ pitch: -20 })
    const b = basis(c)
    const m = groundMatrix(b, c, 0, 5, 1.6, 100, 100, 0.01)
    expect(m).toMatch(/^matrix3d\(/)
    const n = m!.slice(9, -1).split(',').map(Number)
    // The element's centre (50, 50) lands where the point on the ground 5 m ahead projects.
    const X = n[0] * 50 + n[4] * 50 + n[12]
    const Y = n[1] * 50 + n[5] * 50 + n[13]
    const W = n[3] * 50 + n[7] * 50 + n[15]
    const ahead = project(b, c, vecToDir([0, -1.6, -5]))
    expect(X / W).toBeCloseTo(ahead.x, 3)
    expect(Y / W).toBeCloseTo(ahead.y, 3)
  })

  it('hides an arrow behind you', () => {
    const c = cam()
    expect(groundMatrix(basis(c), c, 180, 5, 1.6, 100, 100, 0.01)).toBeNull()
  })
})
