import { expect, test } from 'bun:test';
import { PLAYER_COLORS } from '../../ts/src/game/ui/slotColors';
import { teamColourPixels, teamLayerPixels } from './team-colour-check';

test('isolated Coal under Rifleman pigment passes while the lit comparison identifies pigment as a player hue', () => {
  const neutral = new Uint8Array([79, 56, 29, 255]);
  const red = new Uint8Array([176, 46, 12, 255]);
  expect(Object.keys(teamColourPixels(neutral, red).found)).not.toHaveLength(0);
  expect(teamLayerPixels(new Uint8Array([79, 79, 85, 255]))).toEqual({ masked: 1, found: {} });
});

test('the isolated pass rejects all twelve player colours, including Gray', () => {
  for (const color of PLAYER_COLORS) {
    const rgb = [(color.rgb >> 16) & 255, (color.rgb >> 8) & 255, color.rgb & 255];
    for (const opacity of [1, 0.5]) {
      const pixel = new Uint8Array([...rgb.map((value) => Math.round(value * opacity)), 255]);
      expect(Object.keys(teamLayerPixels(pixel).found)).not.toHaveLength(0);
    }
  }
});
