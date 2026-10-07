# Fighter movement and recovery clips

Generated from the packaged models by `bun wisp view motion --assets DIR` (#171). Each row follows production pose selection over the state's completed frames. Motion is the greatest local vertex travel; body is the mean of each vertex's greatest travel, in world units. The direction column measures vertex travel toward/against the action's direction (vertical for standing up or crouching, horizontal otherwise). Local measurements exclude the simulation's movement across the stage. Clip numbers and names identify sequences of the fighter's model. A zero reveals a held pose. These measurements expose gaps; a stock Walk in a roll row still needs a roll clip.

| Fighter | State | Clip | Motion | Body | Direction; toward/against |
| --- | --- | --- | ---: | ---: | --- |
| Archer | walk | 57: Walk | 96.2 | 31.2 | forward; 94.3/81.4 |
| Archer | dash | 57: Walk | 94.3 | 30.3 | forward; 92.6/80.1 |
| Archer | run | 57: Walk | 100.5 | 27.9 | forward; 98.4/100.0 |
| Archer | turn | 57: Walk | 28.3 | 11.2 | back; 8.7/22.7 |
| Archer | brake | 57: Walk | 28.2 | 12.7 | in place; 22.9/10.0 |
| Archer | jump-squat | 40: Stand | 0.4 | 0.0 | down; 0.2/0.1 |
| Archer | roll-forward | 33: Roll Forward | 135.1 | 51.3 | forward; 73.6/123.5 |
| Archer | roll-back | 32: Roll Backward | 135.0 | 51.3 | back; 123.5/73.0 |
| Archer | spot-dodge | 39: Spot Dodge | 28.4 | 7.8 | in place; 28.1/20.4 |
| Archer | air-dodge | 61: Recovery airDodge | 40.3 | 15.0 | in place; 22.8/23.3 |
| Archer | tech | 22: Get Up | 85.0 | 47.8 | in place; 77.3/84.9 |
| Archer | tech-forward | 33: Roll Forward | 135.4 | 51.3 | forward; 73.6/123.7 |
| Archer | tech-back | 32: Roll Backward | 135.4 | 51.3 | back; 123.7/73.4 |
| Archer | get-up | 22: Get Up | 85.1 | 47.8 | up; 83.7/58.1 |
| Archer | get-up-forward | 33: Roll Forward | 135.5 | 51.3 | forward; 73.6/123.5 |
| Archer | get-up-back | 32: Roll Backward | 135.4 | 51.2 | back; 123.4/73.2 |
| Archer | get-up-attack | 23: Get Up Attack | 91.2 | 47.3 | both; 77.4/85.2 |
| Archer | ledge-get-up | 29: Ledge Climb | 95.3 | 13.5 | up; 39.1/78.3 |
| Archer | ledge-roll | 33: Roll Forward | 135.4 | 51.3 | forward; 73.5/123.3 |
| Archer | ledge-attack | 23: Get Up Attack | 89.5 | 47.1 | both; 77.4/85.1 |
| Rifleman | walk | 54: Walk | 75.6 | 23.6 | forward; 66.5/74.8 |
| Rifleman | dash | 54: Walk | 75.6 | 23.4 | forward; 66.5/74.2 |
| Rifleman | run | 54: Walk | 60.8 | 21.7 | forward; 43.2/51.7 |
| Rifleman | turn | 54: Walk | 44.4 | 6.5 | back; 21.6/29.1 |
| Rifleman | brake | 54: Walk | 49.3 | 7.8 | in place; 32.2/21.7 |
| Rifleman | jump-squat | 40: Stand | 0.3 | 0.1 | down; 0.3/0.1 |
| Rifleman | roll-forward | 32: Roll Forward | 116.6 | 45.3 | forward; 71.9/116.5 |
| Rifleman | roll-back | 31: Roll Backward | 116.6 | 45.3 | back; 116.5/71.9 |
| Rifleman | spot-dodge | 39: Spot Dodge | 20.3 | 7.9 | in place; 10.3/10.7 |
| Rifleman | air-dodge | 58: Recovery airDodge | 40.8 | 13.6 | in place; 17.2/20.0 |
| Rifleman | tech | 21: Get Up | 111.0 | 36.9 | in place; 110.9/60.0 |
| Rifleman | tech-forward | 32: Roll Forward | 116.9 | 45.3 | forward; 71.9/116.7 |
| Rifleman | tech-back | 31: Roll Backward | 116.9 | 45.3 | back; 116.7/71.9 |
| Rifleman | get-up | 21: Get Up | 111.1 | 37.0 | up; 86.9/47.3 |
| Rifleman | get-up-forward | 32: Roll Forward | 116.9 | 45.3 | forward; 71.6/116.6 |
| Rifleman | get-up-back | 31: Roll Backward | 116.9 | 45.3 | back; 116.7/71.4 |
| Rifleman | get-up-attack | 22: Get Up Attack | 113.1 | 39.4 | both; 112.9/61.4 |
| Rifleman | ledge-get-up | 28: Ledge Climb | 64.7 | 7.9 | up; 27.7/64.2 |
| Rifleman | ledge-roll | 32: Roll Forward | 116.8 | 45.4 | forward; 72.0/116.4 |
| Rifleman | ledge-attack | 22: Get Up Attack | 113.1 | 39.4 | both; 112.9/61.4 |
| Illidan | walk | 109: Walk Forward | 48.2 | 10.5 | forward; 45.8/40.6 |
| Illidan | dash | 17: Dash Start | 113.6 | 18.7 | forward; 57.0/103.1 |
| Illidan | run | 64: Run Forward | 108.8 | 17.3 | forward; 106.9/107.8 |
| Illidan | turn | 97: Turnaround | 95.2 | 23.1 | back; 77.5/83.4 |
| Illidan | brake | 89: Stop | 22.3 | 9.4 | in place; 22.3/10.4 |
| Illidan | jump-squat | 47: Jump Squat | 73.7 | 11.1 | down; 36.1/26.9 |
| Illidan | roll-forward | 63: Roll Forward | 148.5 | 70.0 | forward; 118.7/96.8 |
| Illidan | roll-back | 62: Roll Backward | 147.7 | 70.5 | back; 95.4/118.7 |
| Illidan | spot-dodge | 80: Spot Dodge | 140.4 | 30.0 | in place; 53.8/78.4 |
| Illidan | air-dodge | 5: Air Dodge | 111.2 | 20.9 | in place; 34.1/56.4 |
| Illidan | tech | 92: Tech Neutral | 162.1 | 88.5 | in place; 104.9/143.6 |
| Illidan | tech-forward | 91: Tech Forward | 126.6 | 63.8 | forward; 118.5/92.0 |
| Illidan | tech-back | 90: Tech Back | 126.5 | 64.5 | back; 91.1/118.5 |
| Illidan | get-up | 38: Get Up | 155.7 | 87.9 | up; 133.1/72.0 |
| Illidan | get-up-forward | 41: Get Up Roll Forward | 148.9 | 69.8 | forward; 118.6/98.8 |
| Illidan | get-up-back | 40: Get Up Roll Back | 148.5 | 70.2 | back; 95.9/118.5 |
| Illidan | get-up-attack | 39: Get Up Attack | 158.6 | 89.4 | both; 141.9/115.7 |
| Illidan | ledge-get-up | 54: Ledge Climb | 158.4 | 47.7 | up; 40.8/127.3 |
| Illidan | ledge-roll | 57: Ledge Roll | 149.0 | 69.9 | forward; 118.7/93.9 |
| Illidan | ledge-attack | 52: Ledge Attack | 146.8 | 28.2 | both; 130.6/126.0 |
| Blademaster | walk | 6: Walk | 117.2 | 47.3 | forward; 113.0/115.1 |
| Blademaster | dash | 6: Walk | 115.2 | 46.8 | forward; 112.9/112.2 |
| Blademaster | run | 6: Walk | 107.9 | 39.8 | forward; 104.4/91.3 |
| Blademaster | turn | 6: Walk | 34.8 | 17.9 | back; 11.6/27.6 |
| Blademaster | brake | 6: Walk | 35.7 | 19.7 | in place; 30.4/12.8 |
| Blademaster | jump-squat | 9: Stand Ready | 0.0 | 0.0 | down; 0.0/0.0 |
| Blademaster | roll-forward | 23: Recovery rollForward | 226.6 | 79.7 | forward; 158.8/118.2 |
| Blademaster | roll-back | 24: Recovery rollBackward | 227.0 | 80.9 | back; 118.5/160.4 |
| Blademaster | spot-dodge | 25: Recovery spotDodge | 115.2 | 37.9 | in place; 106.3/45.0 |
| Blademaster | air-dodge | 17: Recovery airDodge | 116.1 | 27.3 | in place; 111.8/45.6 |
| Blademaster | tech | 26: Recovery getUp | 174.7 | 73.4 | in place; 130.6/163.9 |
| Blademaster | tech-forward | 23: Recovery rollForward | 226.4 | 78.1 | forward; 158.8/118.3 |
| Blademaster | tech-back | 24: Recovery rollBackward | 227.2 | 77.6 | back; 118.6/160.8 |
| Blademaster | get-up | 26: Recovery getUp | 175.3 | 73.7 | up; 114.7/76.5 |
| Blademaster | get-up-forward | 23: Recovery rollForward | 226.7 | 79.4 | forward; 158.6/118.3 |
| Blademaster | get-up-back | 24: Recovery rollBackward | 226.4 | 79.6 | back; 118.5/161.1 |
| Blademaster | get-up-attack | 27: Recovery getUpAttack | 227.8 | 90.7 | both; 155.0/217.0 |
| Blademaster | ledge-get-up | 28: Recovery ledgeClimb | 136.7 | 86.3 | up; 122.8/60.7 |
| Blademaster | ledge-roll | 29: Recovery ledgeRoll | 194.1 | 64.8 | forward; 149.2/142.8 |
| Blademaster | ledge-attack | 30: Recovery ledgeAttack | 194.6 | 92.1 | both; 114.1/194.2 |
| Mountain King | walk | 7: Walk | 84.3 | 28.2 | forward; 71.0/79.3 |
| Mountain King | dash | 7: Walk | 82.9 | 27.6 | forward; 70.9/77.8 |
| Mountain King | run | 7: Walk | 83.9 | 25.1 | forward; 78.5/72.4 |
| Mountain King | turn | 7: Walk | 22.9 | 6.6 | back; 17.9/19.3 |
| Mountain King | brake | 7: Walk | 22.8 | 7.4 | in place; 20.7/17.9 |
| Mountain King | jump-squat | 1: Stand Ready | 0.0 | 0.0 | down; 0.0/0.0 |
| Mountain King | roll-forward | 36: Recovery rollForward | 114.3 | 49.0 | forward; 97.0/105.8 |
| Mountain King | roll-back | 37: Recovery rollBackward | 114.5 | 49.5 | back; 105.7/97.4 |
| Mountain King | spot-dodge | 38: Recovery spotDodge | 38.3 | 14.1 | in place; 25.1/24.0 |
| Mountain King | air-dodge | 30: Recovery airDodge | 37.8 | 12.6 | in place; 23.0/21.5 |
| Mountain King | tech | 39: Recovery getUp | 81.3 | 31.2 | in place; 78.8/52.5 |
| Mountain King | tech-forward | 36: Recovery rollForward | 113.7 | 48.6 | forward; 96.8/105.8 |
| Mountain King | tech-back | 37: Recovery rollBackward | 114.1 | 49.0 | back; 105.7/97.3 |
| Mountain King | get-up | 39: Recovery getUp | 81.5 | 31.3 | up; 59.0/78.2 |
| Mountain King | get-up-forward | 36: Recovery rollForward | 114.2 | 48.8 | forward; 96.8/105.6 |
| Mountain King | get-up-back | 37: Recovery rollBackward | 114.1 | 49.1 | back; 105.9/97.4 |
| Mountain King | get-up-attack | 40: Recovery getUpAttack | 124.6 | 56.8 | both; 106.3/109.5 |
| Mountain King | ledge-get-up | 41: Recovery ledgeClimb | 112.3 | 64.2 | up; 110.7/0.0 |
| Mountain King | ledge-roll | 42: Recovery ledgeRoll | 109.9 | 43.3 | forward; 71.0/83.6 |
| Mountain King | ledge-attack | 43: Recovery ledgeAttack | 185.5 | 83.0 | both; 110.7/106.4 |
| Warden | walk | 2: Walk | 87.6 | 21.6 | forward; 87.4/85.1 |
| Warden | dash | 2: Walk | 87.4 | 20.6 | forward; 86.2/85.0 |
| Warden | run | 2: Walk | 62.0 | 21.3 | forward; 58.4/59.0 |
| Warden | turn | 2: Walk | 38.0 | 14.8 | back; 13.1/21.8 |
| Warden | brake | 2: Walk | 40.5 | 15.7 | in place; 23.7/15.5 |
| Warden | jump-squat | 4: Stand Ready | 0.0 | 0.0 | down; 0.0/0.0 |
| Warden | roll-forward | 21: Recovery rollForward | 165.5 | 69.1 | forward; 151.6/88.5 |
| Warden | roll-back | 22: Recovery rollBackward | 165.5 | 68.9 | back; 88.8/151.8 |
| Warden | spot-dodge | 23: Recovery spotDodge | 62.8 | 20.1 | in place; 50.1/36.3 |
| Warden | air-dodge | 15: Recovery airDodge | 52.9 | 18.6 | in place; 46.1/32.9 |
| Warden | tech | 24: Recovery getUp | 128.6 | 51.8 | in place; 98.2/70.1 |
| Warden | tech-forward | 21: Recovery rollForward | 165.6 | 68.9 | forward; 152.0/88.4 |
| Warden | tech-back | 22: Recovery rollBackward | 165.5 | 68.1 | back; 88.8/152.1 |
| Warden | get-up | 24: Recovery getUp | 129.0 | 52.0 | up; 108.2/99.9 |
| Warden | get-up-forward | 21: Recovery rollForward | 165.3 | 68.6 | forward; 151.9/88.4 |
| Warden | get-up-back | 22: Recovery rollBackward | 165.5 | 68.7 | back; 88.6/152.1 |
| Warden | get-up-attack | 25: Recovery getUpAttack | 185.3 | 81.1 | both; 171.8/148.7 |
| Warden | ledge-get-up | 26: Recovery ledgeClimb | 135.3 | 75.0 | up; 120.3/23.3 |
| Warden | ledge-roll | 27: Recovery ledgeRoll | 157.1 | 61.0 | forward; 105.5/138.6 |
| Warden | ledge-attack | 28: Recovery ledgeAttack | 192.7 | 94.7 | both; 170.1/88.9 |
| Lich | walk | 4: Walk | 70.7 | 11.0 | forward; 49.7/20.6 |
| Lich | dash | 4: Walk | 57.3 | 9.2 | forward; 45.0/19.5 |
| Lich | run | 4: Walk | 77.1 | 14.1 | forward; 31.6/42.2 |
| Lich | turn | 4: Walk | 22.5 | 3.5 | back; 11.1/13.2 |
| Lich | brake | 4: Walk | 25.3 | 3.9 | in place; 14.7/11.0 |
| Lich | jump-squat | 1: Stand Ready | 0.0 | 0.0 | down; 0.0/0.0 |
| Lich | roll-forward | 19: Recovery rollForward | 205.5 | 102.6 | forward; 195.4/96.8 |
| Lich | roll-back | 20: Recovery rollBackward | 207.0 | 103.7 | back; 92.9/204.8 |
| Lich | spot-dodge | 21: Recovery spotDodge | 106.7 | 35.4 | in place; 106.4/39.3 |
| Lich | air-dodge | 13: Recovery airDodge | 101.5 | 27.0 | in place; 96.7/34.6 |
| Lich | tech | 22: Recovery getUp | 152.2 | 88.4 | in place; 103.8/72.8 |
| Lich | tech-forward | 19: Recovery rollForward | 205.5 | 101.5 | forward; 196.0/96.8 |
| Lich | tech-back | 20: Recovery rollBackward | 207.0 | 102.5 | back; 93.0/204.8 |
| Lich | get-up | 22: Recovery getUp | 152.5 | 89.1 | up; 136.7/146.6 |
| Lich | get-up-forward | 19: Recovery rollForward | 205.7 | 101.8 | forward; 196.0/96.8 |
| Lich | get-up-back | 20: Recovery rollBackward | 207.0 | 103.3 | back; 93.1/204.7 |
| Lich | get-up-attack | 23: Recovery getUpAttack | 215.1 | 129.6 | both; 180.8/144.1 |
| Lich | ledge-get-up | 24: Recovery ledgeClimb | 147.3 | 101.3 | up; 136.9/82.2 |
| Lich | ledge-roll | 25: Recovery ledgeRoll | 179.3 | 121.3 | forward; 118.8/164.2 |
| Lich | ledge-attack | 26: Recovery ledgeAttack | 175.6 | 125.6 | both; 110.6/108.8 |
| Uther | walk | 12: Walk | 110.1 | 45.9 | forward; 98.7/109.9 |
| Uther | dash | 12: Walk | 110.1 | 44.8 | forward; 98.3/110.0 |
| Uther | run | 12: Walk | 88.1 | 33.6 | forward; 85.9/80.2 |
| Uther | turn | 12: Walk | 39.7 | 15.4 | back; 25.2/15.1 |
| Uther | brake | 12: Walk | 42.9 | 17.8 | in place; 16.7/28.9 |
| Uther | jump-squat | 0: Stand - 1 | 0.8 | 0.0 | down; 0.2/0.2 |
| Uther | roll-forward | 22: Recovery rollForward | 211.3 | 85.9 | forward; 211.0/62.8 |
| Uther | roll-back | 23: Recovery rollBackward | 211.3 | 86.0 | back; 62.7/211.2 |
| Uther | spot-dodge | 24: Recovery spotDodge | 63.9 | 21.5 | in place; 35.6/19.5 |
| Uther | air-dodge | 16: Recovery airDodge | 62.5 | 23.1 | in place; 31.0/17.6 |
| Uther | tech | 25: Recovery getUp | 132.8 | 53.2 | in place; 65.9/108.9 |
| Uther | tech-forward | 22: Recovery rollForward | 211.4 | 85.9 | forward; 211.2/62.8 |
| Uther | tech-back | 23: Recovery rollBackward | 211.7 | 85.5 | back; 62.8/211.7 |
| Uther | get-up | 25: Recovery getUp | 133.1 | 53.3 | up; 57.9/107.8 |
| Uther | get-up-forward | 22: Recovery rollForward | 211.5 | 85.9 | forward; 211.4/62.8 |
| Uther | get-up-back | 23: Recovery rollBackward | 211.4 | 85.9 | back; 62.9/211.2 |
| Uther | get-up-attack | 26: Recovery getUpAttack | 139.0 | 70.3 | both; 103.0/115.7 |
| Uther | ledge-get-up | 27: Recovery ledgeClimb | 95.9 | 63.4 | up; 91.8/38.8 |
| Uther | ledge-roll | 28: Recovery ledgeRoll | 143.9 | 87.2 | forward; 109.0/125.5 |
| Uther | ledge-attack | 29: Recovery ledgeAttack | 186.6 | 83.1 | both; 186.2/62.5 |
| Dreadlord | walk | 5: Walk | 115.4 | 38.3 | forward; 115.3/109.0 |
| Dreadlord | dash | 5: Walk | 115.7 | 38.0 | forward; 115.7/107.5 |
| Dreadlord | run | 5: Walk | 104.1 | 38.3 | forward; 100.9/102.5 |
| Dreadlord | turn | 5: Walk | 35.5 | 11.5 | back; 22.4/19.3 |
| Dreadlord | brake | 5: Walk | 36.4 | 12.2 | in place; 20.8/23.7 |
| Dreadlord | jump-squat | 1: Stand Ready | 0.0 | 0.0 | down; 0.0/0.0 |
| Dreadlord | roll-forward | 21: Recovery rollForward | 171.6 | 82.8 | forward; 100.3/125.2 |
| Dreadlord | roll-back | 22: Recovery rollBackward | 171.9 | 83.3 | back; 126.4/97.3 |
| Dreadlord | spot-dodge | 23: Recovery spotDodge | 59.0 | 25.0 | in place; 47.8/39.2 |
| Dreadlord | air-dodge | 15: Recovery airDodge | 58.8 | 22.9 | in place; 42.6/35.1 |
| Dreadlord | tech | 24: Recovery getUp | 133.4 | 64.7 | in place; 120.7/81.0 |
| Dreadlord | tech-forward | 21: Recovery rollForward | 171.5 | 82.6 | forward; 100.4/125.2 |
| Dreadlord | tech-back | 22: Recovery rollBackward | 171.9 | 83.1 | back; 126.2/97.4 |
| Dreadlord | get-up | 24: Recovery getUp | 134.0 | 64.9 | up; 125.3/94.8 |
| Dreadlord | get-up-forward | 21: Recovery rollForward | 171.4 | 82.5 | forward; 100.1/125.1 |
| Dreadlord | get-up-back | 22: Recovery rollBackward | 171.4 | 83.0 | back; 126.1/97.4 |
| Dreadlord | get-up-attack | 25: Recovery getUpAttack | 197.7 | 97.0 | both; 193.7/170.3 |
| Dreadlord | ledge-get-up | 26: Recovery ledgeClimb | 146.1 | 90.2 | up; 136.5/12.4 |
| Dreadlord | ledge-roll | 27: Recovery ledgeRoll | 146.5 | 70.8 | forward; 124.9/130.7 |
| Dreadlord | ledge-attack | 28: Recovery ledgeAttack | 209.7 | 109.2 | both; 203.6/81.6 |
| Shadow Hunter | walk | 0: Walk | 173.2 | 44.3 | forward; 158.1/166.2 |
| Shadow Hunter | dash | 0: Walk | 171.9 | 35.9 | forward; 157.1/164.3 |
| Shadow Hunter | run | 0: Walk | 102.6 | 33.6 | forward; 97.1/100.3 |
| Shadow Hunter | turn | 0: Walk | 47.1 | 16.0 | back; 43.2/29.3 |
| Shadow Hunter | brake | 0: Walk | 52.6 | 17.5 | in place; 32.2/46.1 |
| Shadow Hunter | jump-squat | 7: Stand Ready | 0.0 | 0.0 | down; 0.0/0.0 |
| Shadow Hunter | roll-forward | 23: Recovery rollForward | 156.4 | 70.5 | forward; 130.9/147.0 |
| Shadow Hunter | roll-back | 24: Recovery rollBackward | 156.5 | 70.7 | back; 147.2/130.8 |
| Shadow Hunter | spot-dodge | 25: Recovery spotDodge | 64.1 | 20.2 | in place; 35.9/34.6 |
| Shadow Hunter | air-dodge | 17: Recovery airDodge | 57.3 | 20.0 | in place; 31.8/31.9 |
| Shadow Hunter | tech | 26: Recovery getUp | 125.2 | 48.4 | in place; 124.6/100.9 |
| Shadow Hunter | tech-forward | 23: Recovery rollForward | 156.7 | 70.2 | forward; 130.7/146.9 |
| Shadow Hunter | tech-back | 24: Recovery rollBackward | 156.5 | 70.4 | back; 147.0/130.8 |
| Shadow Hunter | get-up | 26: Recovery getUp | 125.7 | 48.6 | up; 68.4/105.4 |
| Shadow Hunter | get-up-forward | 23: Recovery rollForward | 156.6 | 70.4 | forward; 130.6/147.0 |
| Shadow Hunter | get-up-back | 24: Recovery rollBackward | 156.2 | 70.4 | back; 147.0/130.8 |
| Shadow Hunter | get-up-attack | 27: Recovery getUpAttack | 262.8 | 105.0 | both; 222.4/138.1 |
| Shadow Hunter | ledge-get-up | 28: Recovery ledgeClimb | 114.2 | 64.6 | up; 95.6/30.7 |
| Shadow Hunter | ledge-roll | 29: Recovery ledgeRoll | 160.8 | 71.5 | forward; 114.4/120.6 |
| Shadow Hunter | ledge-attack | 30: Recovery ledgeAttack | 265.1 | 117.2 | both; 184.2/115.4 |
| Pit Lord | walk | 1: Walk | 103.7 | 21.6 | forward; 99.4/98.7 |
| Pit Lord | dash | 3: Walk Fast | 149.6 | 39.7 | forward; 145.9/91.5 |
| Pit Lord | run | 3: Walk Fast | 130.0 | 42.7 | forward; 99.2/129.5 |
| Pit Lord | turn | 1: Walk | 35.7 | 4.0 | back; 11.2/34.5 |
| Pit Lord | brake | 1: Walk | 39.5 | 4.5 | in place; 38.6/12.5 |
| Pit Lord | jump-squat | 2: Stand | 0.0 | 0.0 | down; 0.0/0.0 |
| Pit Lord | roll-forward | 26: Recovery rollForward | 355.9 | 162.4 | forward; 288.0/341.3 |
| Pit Lord | roll-back | 27: Recovery rollBackward | 364.5 | 169.6 | back; 344.8/282.3 |
| Pit Lord | spot-dodge | 28: Recovery spotDodge | 152.1 | 76.0 | in place; 96.9/56.0 |
| Pit Lord | air-dodge | 20: Recovery airDodge | 122.0 | 39.4 | in place; 89.6/54.2 |
| Pit Lord | tech | 29: Recovery getUp | 305.1 | 92.1 | in place; 164.6/93.6 |
| Pit Lord | tech-forward | 26: Recovery rollForward | 356.8 | 161.1 | forward; 287.9/341.2 |
| Pit Lord | tech-back | 27: Recovery rollBackward | 364.9 | 165.6 | back; 345.1/283.0 |
| Pit Lord | get-up | 29: Recovery getUp | 305.9 | 92.5 | up; 168.9/297.3 |
| Pit Lord | get-up-forward | 26: Recovery rollForward | 356.1 | 161.9 | forward; 288.3/341.4 |
| Pit Lord | get-up-back | 27: Recovery rollBackward | 364.9 | 169.4 | back; 345.1/283.0 |
| Pit Lord | get-up-attack | 30: Recovery getUpAttack | 336.6 | 160.5 | both; 231.3/332.0 |
| Pit Lord | ledge-get-up | 31: Recovery ledgeClimb | 227.5 | 95.5 | up; 226.6/141.8 |
| Pit Lord | ledge-roll | 32: Recovery ledgeRoll | 383.6 | 161.1 | forward; 252.3/222.9 |
| Pit Lord | ledge-attack | 33: Recovery ledgeAttack | 231.9 | 118.7 | both; 152.7/83.3 |
| Beastmaster | walk | 0: walk | 181.5 | 54.1 | forward; 149.1/180.8 |
| Beastmaster | dash | 0: walk | 181.5 | 53.6 | forward; 148.2/180.8 |
| Beastmaster | run | 0: walk | 119.7 | 42.5 | forward; 103.5/94.2 |
| Beastmaster | turn | 0: walk | 35.5 | 10.4 | back; 34.1/18.3 |
| Beastmaster | brake | 0: walk | 38.2 | 11.5 | in place; 20.6/36.8 |
| Beastmaster | jump-squat | 9: Stand Ready | 0.0 | 0.0 | down; 0.0/0.0 |
| Beastmaster | roll-forward | 19: Recovery rollForward | 187.0 | 91.2 | forward; 101.0/165.1 |
| Beastmaster | roll-back | 20: Recovery rollBackward | 186.8 | 91.4 | back; 165.1/100.8 |
| Beastmaster | spot-dodge | 21: Recovery spotDodge | 74.4 | 37.9 | in place; 41.0/36.9 |
| Beastmaster | air-dodge | 13: Recovery airDodge | 58.6 | 25.4 | in place; 36.7/33.2 |
| Beastmaster | tech | 22: Recovery getUp | 123.1 | 61.4 | in place; 113.8/98.3 |
| Beastmaster | tech-forward | 19: Recovery rollForward | 186.9 | 90.9 | forward; 101.1/164.8 |
| Beastmaster | tech-back | 20: Recovery rollBackward | 186.3 | 90.8 | back; 165.0/101.0 |
| Beastmaster | get-up | 22: Recovery getUp | 123.8 | 61.8 | up; 114.2/103.9 |
| Beastmaster | get-up-forward | 19: Recovery rollForward | 187.1 | 91.0 | forward; 100.9/165.1 |
| Beastmaster | get-up-back | 20: Recovery rollBackward | 186.3 | 91.0 | back; 164.9/101.1 |
| Beastmaster | get-up-attack | 23: Recovery getUpAttack | 271.9 | 97.0 | both; 192.0/164.1 |
| Beastmaster | ledge-get-up | 24: Recovery ledgeClimb | 146.7 | 77.7 | up; 145.7/12.9 |
| Beastmaster | ledge-roll | 25: Recovery ledgeRoll | 146.2 | 80.6 | forward; 120.2/130.2 |
| Beastmaster | ledge-attack | 26: Recovery ledgeAttack | 279.6 | 95.6 | both; 171.8/113.6 |
| Lich King | walk | 2: Walk | 90.9 | 24.8 | forward; 89.3/85.8 |
| Lich King | dash | 10: Walk Fast | 98.4 | 35.4 | forward; 83.5/89.3 |
| Lich King | run | 10: Walk Fast | 109.3 | 32.2 | forward; 96.0/98.8 |
| Lich King | turn | 2: Walk | 13.9 | 3.6 | back; 10.4/10.9 |
| Lich King | brake | 2: Walk | 14.0 | 4.0 | in place; 11.6/12.0 |
| Lich King | jump-squat | 25: Fall | 0.0 | 0.0 | down; 0.0/0.0 |
| Lich King | roll-forward | 33: Roll Forward | 253.4 | 58.8 | forward; 50.7/58.9 |
| Lich King | roll-back | 34: Roll Backward | 75.1 | 30.6 | back; 57.3/63.1 |
| Lich King | spot-dodge | 32: Spot Dodge | 73.5 | 30.6 | in place; 16.7/73.5 |
| Lich King | air-dodge | 35: Air Dodge | 162.1 | 20.4 | in place; 44.9/94.2 |
| Lich King | tech | 54: Get Up | 193.0 | 96.7 | in place; 62.4/122.0 |
| Lich King | tech-forward | 33: Roll Forward | 253.4 | 58.8 | forward; 49.3/58.9 |
| Lich King | tech-back | 34: Roll Backward | 75.1 | 30.6 | back; 57.3/63.1 |
| Lich King | get-up | 54: Get Up | 193.2 | 96.9 | up; 185.1/60.1 |
| Lich King | get-up-forward | 33: Roll Forward | 253.4 | 58.8 | forward; 50.5/58.9 |
| Lich King | get-up-back | 34: Roll Backward | 75.1 | 30.6 | back; 57.3/63.1 |
| Lich King | get-up-attack | 55: Get Up Attack | 226.1 | 99.6 | both; 80.6/213.9 |
| Lich King | ledge-get-up | 57: Ledge Climb | 249.7 | 43.8 | up; 248.6/72.8 |
| Lich King | ledge-roll | 58: Ledge Roll | 244.1 | 53.4 | forward; 79.2/80.2 |
| Lich King | ledge-attack | 59: Ledge Attack | 283.8 | 51.2 | both; 150.2/170.6 |

Walking/running cadence uses grounded vertices' horizontal excursion twice per cycle. The Lich floats and uses the stock sequence's movement speed. Both measurements use the fighter's displayed model scale.
