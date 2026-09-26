import { coverPoint } from './geometry';

describe('coverPoint', () => {
  it('maps art fractions straight through when the container has the art’s shape', () => {
    expect(coverPoint(1600, 900, 16 / 9, 0.5, 0.25)).toEqual({ x: 800, y: 225 });
  });

  it('crops the sides of wide art in a tall (phone) container, keeping it centred', () => {
    // 390×844 portrait: the 16:9 art is scaled to 844 tall → 1500.4 wide.
    const centre = coverPoint(390, 844, 16 / 9, 0.5, 0.5);
    expect(centre.x).toBeCloseTo(195);
    expect(centre.y).toBeCloseTo(422);
    const left = coverPoint(390, 844, 16 / 9, 0, 0.5);
    expect(left.x).toBeLessThan(-500);
  });

  it('crops top and bottom of square art in a wide container', () => {
    const top = coverPoint(1000, 500, 1, 0.5, 0);
    expect(top).toEqual({ x: 500, y: -250 });
  });
});
