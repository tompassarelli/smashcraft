# Fighter movement and recovery clips

Generated from the packaged models by `bun wisp view motion --assets DIR` (#171). Each row follows production pose selection over the state's completed frames. Motion is the greatest local vertex travel; body is the mean of each vertex's greatest travel, in world units. The direction column measures vertex travel toward/against the action's direction (vertical for standing up or crouching, horizontal otherwise). Local measurements exclude the simulation's movement across the stage. Clip numbers and names identify sequences of the fighter's model. A zero reveals a held pose. These measurements expose gaps; a stock Walk in a roll row still needs a roll clip.

| Fighter | State | Clip | Motion | Body | Direction; toward/against |
| --- | --- | --- | ---: | ---: | --- |
| Archer | walk | 57: Walk | 96.2 | 31.2 | forward; 94.3/81.4 |
| Archer | dash | 57: Walk | 94.3 | 30.3 | forward; 92.6/80.1 |
| Archer | run | 57: Walk | 83.2 | 28.5 | forward; 81.9/76.7 |
| Archer | turn | 58: Recovery turn | 113.2 | 27.0 | back; 52.3/113.2 |
| Archer | brake | 59: Recovery stop | 26.8 | 10.5 | in place; 14.2/26.2 |
| Archer | jump-squat | 60: Recovery jumpSquat | 31.6 | 14.9 | down; 31.1/19.7 |
| Archer | roll-forward | 33: Roll Forward | 135.1 | 51.3 | forward; 73.6/123.5 |
| Archer | roll-back | 32: Roll Backward | 135.0 | 51.3 | back; 123.5/73.0 |
| Archer | spot-dodge | 39: Spot Dodge | 28.4 | 7.8 | in place; 28.1/20.4 |
| Archer | air-dodge | 61: Recovery airDodge | 40.3 | 15.0 | in place; 22.8/23.3 |
| Archer | tech | 62: Recovery tech | 82.2 | 39.7 | in place; 79.4/64.3 |
| Archer | tech-forward | 63: Recovery techForward | 100.0 | 52.3 | forward; 82.6/86.9 |
| Archer | tech-back | 64: Recovery techBackward | 100.8 | 47.8 | back; 79.8/89.1 |
| Archer | get-up | 22: Get Up | 85.1 | 47.8 | up; 83.7/58.1 |
| Archer | get-up-forward | 65: Recovery getUpRollForward | 100.0 | 52.4 | forward; 82.6/86.8 |
| Archer | get-up-back | 66: Recovery getUpRollBackward | 100.9 | 48.0 | back; 79.9/89.0 |
| Archer | get-up-attack | 23: Get Up Attack | 91.2 | 47.3 | both; 77.4/85.2 |
| Archer | ledge-get-up | 29: Ledge Climb | 95.3 | 13.5 | up; 39.1/78.3 |
| Archer | ledge-roll | 33: Roll Forward | 135.4 | 51.3 | forward; 73.5/123.3 |
| Archer | ledge-attack | 23: Get Up Attack | 89.5 | 47.1 | both; 77.4/85.1 |
| Rifleman | walk | 54: Walk | 75.6 | 23.6 | forward; 66.5/74.8 |
| Rifleman | dash | 54: Walk | 75.6 | 23.4 | forward; 66.5/74.2 |
| Rifleman | run | 54: Walk | 85.7 | 18.2 | forward; 85.0/83.9 |
| Rifleman | turn | 55: Recovery turn | 143.6 | 27.5 | back; 60.1/143.6 |
| Rifleman | brake | 56: Recovery stop | 23.4 | 9.3 | in place; 10.6/17.1 |
| Rifleman | jump-squat | 57: Recovery jumpSquat | 29.8 | 13.5 | down; 29.6/21.8 |
| Rifleman | roll-forward | 32: Roll Forward | 116.6 | 45.3 | forward; 71.9/116.5 |
| Rifleman | roll-back | 31: Roll Backward | 116.6 | 45.3 | back; 116.5/71.9 |
| Rifleman | spot-dodge | 39: Spot Dodge | 20.3 | 7.9 | in place; 10.3/10.7 |
| Rifleman | air-dodge | 58: Recovery airDodge | 40.8 | 13.6 | in place; 17.2/20.0 |
| Rifleman | tech | 59: Recovery tech | 94.0 | 37.7 | in place; 68.1/48.1 |
| Rifleman | tech-forward | 60: Recovery techForward | 124.8 | 55.8 | forward; 86.3/74.5 |
| Rifleman | tech-back | 61: Recovery techBackward | 115.1 | 64.9 | back; 85.2/74.5 |
| Rifleman | get-up | 21: Get Up | 111.1 | 37.0 | up; 86.9/47.3 |
| Rifleman | get-up-forward | 62: Recovery getUpRollForward | 124.7 | 55.6 | forward; 86.2/74.5 |
| Rifleman | get-up-back | 63: Recovery getUpRollBackward | 115.0 | 64.9 | back; 85.4/74.5 |
| Rifleman | get-up-attack | 22: Get Up Attack | 113.1 | 39.4 | both; 112.9/61.4 |
| Rifleman | ledge-get-up | 28: Ledge Climb | 64.7 | 7.9 | up; 27.7/64.2 |
| Rifleman | ledge-roll | 32: Roll Forward | 116.8 | 45.4 | forward; 72.0/116.4 |
| Rifleman | ledge-attack | 22: Get Up Attack | 113.1 | 39.4 | both; 112.9/61.4 |
| Illidan | walk | 119: Locomotion Walk | 76.8 | 18.0 | forward; 76.4/76.0 |
| Illidan | dash | 121: Locomotion Initial Dash Burst | 81.1 | 19.7 | forward; 72.9/57.8 |
| Illidan | run | 120: Locomotion Run | 111.4 | 23.8 | forward; 108.7/95.2 |
| Illidan | turn | 97: Turnaround | 95.2 | 23.1 | back; 77.5/83.4 |
| Illidan | brake | 89: Stop | 22.3 | 9.4 | in place; 22.3/10.4 |
| Illidan | jump-squat | 47: Jump Squat | 73.7 | 11.1 | down; 36.1/26.9 |
| Illidan | roll-forward | 63: Roll Forward | 148.5 | 70.0 | forward; 118.7/96.8 |
| Illidan | roll-back | 62: Roll Backward | 147.7 | 70.5 | back; 95.4/118.7 |
| Illidan | spot-dodge | 80: Spot Dodge | 140.4 | 30.0 | in place; 53.8/78.4 |
| Illidan | air-dodge | 5: Air Dodge | 111.2 | 20.9 | in place; 34.1/56.4 |
| Illidan | tech | 92: Tech Neutral | 162.1 | 88.5 | in place; 104.9/143.6 |
| Illidan | tech-forward | 91: Tech Forward | 148.4 | 69.9 | forward; 118.5/104.1 |
| Illidan | tech-back | 90: Tech Back | 155.7 | 71.9 | back; 96.1/118.5 |
| Illidan | get-up | 38: Get Up | 155.7 | 87.9 | up; 133.1/72.0 |
| Illidan | get-up-forward | 41: Get Up Roll Forward | 148.9 | 69.8 | forward; 118.6/98.8 |
| Illidan | get-up-back | 40: Get Up Roll Back | 148.5 | 70.2 | back; 95.9/118.5 |
| Illidan | get-up-attack | 39: Get Up Attack | 158.6 | 89.4 | both; 141.9/115.7 |
| Illidan | ledge-get-up | 54: Ledge Climb | 158.4 | 47.7 | up; 40.8/127.3 |
| Illidan | ledge-roll | 57: Ledge Roll | 149.0 | 69.9 | forward; 118.7/93.9 |
| Illidan | ledge-attack | 52: Ledge Attack | 146.8 | 28.2 | both; 130.6/126.0 |
| Blademaster | walk | 6: Walk | 117.2 | 47.3 | forward; 113.0/115.1 |
| Blademaster | dash | 6: Walk | 115.2 | 46.8 | forward; 112.9/112.2 |
| Blademaster | run | 6: Walk | 122.0 | 38.4 | forward; 117.0/121.8 |
| Blademaster | turn | 14: Recovery turn | 137.4 | 31.9 | back; 137.2/96.1 |
| Blademaster | brake | 15: Recovery stop | 148.3 | 28.1 | in place; 143.0/56.9 |
| Blademaster | jump-squat | 16: Recovery jumpSquat | 165.2 | 29.7 | down; 111.1/28.0 |
| Blademaster | roll-forward | 23: Recovery rollForward | 226.6 | 79.7 | forward; 158.8/118.2 |
| Blademaster | roll-back | 24: Recovery rollBackward | 227.0 | 80.9 | back; 118.5/160.4 |
| Blademaster | spot-dodge | 25: Recovery spotDodge | 115.2 | 37.9 | in place; 106.3/45.0 |
| Blademaster | air-dodge | 17: Recovery airDodge | 116.1 | 27.3 | in place; 111.8/45.6 |
| Blademaster | tech | 18: Recovery tech | 150.1 | 65.9 | in place; 125.9/144.4 |
| Blademaster | tech-forward | 19: Recovery techForward | 194.1 | 65.3 | forward; 149.1/143.0 |
| Blademaster | tech-back | 20: Recovery techBackward | 184.2 | 82.2 | back; 163.2/147.8 |
| Blademaster | get-up | 26: Recovery getUp | 175.3 | 73.7 | up; 114.7/76.5 |
| Blademaster | get-up-forward | 21: Recovery getUpRollForward | 193.5 | 65.8 | forward; 148.7/143.0 |
| Blademaster | get-up-back | 22: Recovery getUpRollBackward | 183.5 | 81.8 | back; 163.3/147.7 |
| Blademaster | get-up-attack | 27: Recovery getUpAttack | 227.8 | 90.7 | both; 155.0/217.0 |
| Blademaster | ledge-get-up | 28: Recovery ledgeClimb | 136.7 | 86.3 | up; 122.8/60.7 |
| Blademaster | ledge-roll | 29: Recovery ledgeRoll | 194.1 | 64.8 | forward; 149.2/142.8 |
| Blademaster | ledge-attack | 30: Recovery ledgeAttack | 194.6 | 92.1 | both; 114.1/194.2 |
| Mountain King | walk | 7: Walk | 84.3 | 28.2 | forward; 71.0/79.3 |
| Mountain King | dash | 7: Walk | 82.9 | 27.6 | forward; 70.9/77.8 |
| Mountain King | run | 7: Walk | 80.2 | 21.0 | forward; 71.4/76.6 |
| Mountain King | turn | 27: Recovery turn | 87.0 | 23.1 | back; 84.1/87.0 |
| Mountain King | brake | 28: Recovery stop | 20.9 | 8.6 | in place; 13.4/15.7 |
| Mountain King | jump-squat | 29: Recovery jumpSquat | 30.4 | 11.6 | down; 30.4/13.7 |
| Mountain King | roll-forward | 36: Recovery rollForward | 114.3 | 49.0 | forward; 97.0/105.8 |
| Mountain King | roll-back | 37: Recovery rollBackward | 114.5 | 49.5 | back; 105.7/97.4 |
| Mountain King | spot-dodge | 38: Recovery spotDodge | 38.3 | 14.1 | in place; 25.1/24.0 |
| Mountain King | air-dodge | 30: Recovery airDodge | 37.8 | 12.6 | in place; 23.0/21.5 |
| Mountain King | tech | 31: Recovery tech | 87.5 | 32.0 | in place; 75.0/48.3 |
| Mountain King | tech-forward | 32: Recovery techForward | 109.9 | 43.5 | forward; 71.1/83.5 |
| Mountain King | tech-back | 33: Recovery techBackward | 110.8 | 44.1 | back; 69.7/85.8 |
| Mountain King | get-up | 39: Recovery getUp | 81.5 | 31.3 | up; 59.0/78.2 |
| Mountain King | get-up-forward | 34: Recovery getUpRollForward | 110.0 | 42.8 | forward; 70.9/83.4 |
| Mountain King | get-up-back | 35: Recovery getUpRollBackward | 110.9 | 44.1 | back; 69.7/85.8 |
| Mountain King | get-up-attack | 40: Recovery getUpAttack | 124.6 | 56.8 | both; 106.3/109.5 |
| Mountain King | ledge-get-up | 41: Recovery ledgeClimb | 112.3 | 64.2 | up; 110.7/0.0 |
| Mountain King | ledge-roll | 42: Recovery ledgeRoll | 109.9 | 43.3 | forward; 71.0/83.6 |
| Mountain King | ledge-attack | 43: Recovery ledgeAttack | 185.5 | 83.0 | both; 110.7/106.4 |
| Warden | walk | 2: Walk | 87.6 | 21.6 | forward; 87.4/85.1 |
| Warden | dash | 2: Walk | 87.4 | 20.6 | forward; 86.2/85.0 |
| Warden | run | 2: Walk | 94.8 | 21.4 | forward; 93.6/91.7 |
| Warden | turn | 12: Recovery turn | 128.1 | 27.2 | back; 128.1/90.5 |
| Warden | brake | 13: Recovery stop | 25.9 | 13.8 | in place; 18.8/20.4 |
| Warden | jump-squat | 14: Recovery jumpSquat | 42.8 | 19.4 | down; 41.8/22.1 |
| Warden | roll-forward | 21: Recovery rollForward | 165.5 | 69.1 | forward; 151.6/88.5 |
| Warden | roll-back | 22: Recovery rollBackward | 165.5 | 68.9 | back; 88.8/151.8 |
| Warden | spot-dodge | 23: Recovery spotDodge | 62.8 | 20.1 | in place; 50.1/36.3 |
| Warden | air-dodge | 15: Recovery airDodge | 52.9 | 18.6 | in place; 46.1/32.9 |
| Warden | tech | 16: Recovery tech | 120.3 | 52.0 | in place; 93.9/71.4 |
| Warden | tech-forward | 17: Recovery techForward | 157.1 | 61.6 | forward; 105.6/138.9 |
| Warden | tech-back | 18: Recovery techBackward | 165.6 | 69.6 | back; 105.9/137.5 |
| Warden | get-up | 24: Recovery getUp | 129.0 | 52.0 | up; 108.2/99.9 |
| Warden | get-up-forward | 19: Recovery getUpRollForward | 157.4 | 62.1 | forward; 105.5/139.0 |
| Warden | get-up-back | 20: Recovery getUpRollBackward | 165.6 | 69.6 | back; 106.1/137.5 |
| Warden | get-up-attack | 25: Recovery getUpAttack | 185.3 | 81.1 | both; 171.8/148.7 |
| Warden | ledge-get-up | 26: Recovery ledgeClimb | 135.3 | 75.0 | up; 120.3/23.3 |
| Warden | ledge-roll | 27: Recovery ledgeRoll | 157.1 | 61.0 | forward; 105.5/138.6 |
| Warden | ledge-attack | 28: Recovery ledgeAttack | 192.7 | 94.7 | both; 170.1/88.9 |
| Lich | walk | 4: Walk | 70.7 | 11.0 | forward; 49.7/20.6 |
| Lich | dash | 4: Walk | 57.3 | 9.2 | forward; 45.0/19.5 |
| Lich | run | 4: Walk | 78.6 | 12.5 | forward; 37.7/20.7 |
| Lich | turn | 10: Recovery turn | 216.3 | 43.1 | back; 216.1/88.4 |
| Lich | brake | 11: Recovery stop | 51.6 | 20.2 | in place; 51.4/27.6 |
| Lich | jump-squat | 12: Recovery jumpSquat | 59.8 | 36.6 | down; 57.1/40.5 |
| Lich | roll-forward | 19: Recovery rollForward | 205.5 | 102.6 | forward; 195.4/96.8 |
| Lich | roll-back | 20: Recovery rollBackward | 207.0 | 103.7 | back; 92.9/204.8 |
| Lich | spot-dodge | 21: Recovery spotDodge | 106.7 | 35.4 | in place; 106.4/39.3 |
| Lich | air-dodge | 13: Recovery airDodge | 101.5 | 27.0 | in place; 96.7/34.6 |
| Lich | tech | 14: Recovery tech | 153.6 | 97.2 | in place; 102.4/65.5 |
| Lich | tech-forward | 15: Recovery techForward | 179.2 | 119.3 | forward; 118.7/164.0 |
| Lich | tech-back | 16: Recovery techBackward | 205.4 | 120.8 | back; 117.9/144.2 |
| Lich | get-up | 22: Recovery getUp | 152.5 | 89.1 | up; 136.7/146.6 |
| Lich | get-up-forward | 17: Recovery getUpRollForward | 179.4 | 119.2 | forward; 118.9/164.1 |
| Lich | get-up-back | 18: Recovery getUpRollBackward | 205.3 | 120.7 | back; 117.8/144.2 |
| Lich | get-up-attack | 23: Recovery getUpAttack | 215.1 | 129.6 | both; 180.8/144.1 |
| Lich | ledge-get-up | 24: Recovery ledgeClimb | 147.3 | 101.3 | up; 136.9/82.2 |
| Lich | ledge-roll | 25: Recovery ledgeRoll | 179.3 | 121.3 | forward; 118.8/164.2 |
| Lich | ledge-attack | 26: Recovery ledgeAttack | 175.6 | 125.6 | both; 110.6/108.8 |
| Uther | walk | 12: Walk 1 | 85.8 | 20.9 | forward; 82.9/75.0 |
| Uther | dash | 12: Walk 1 | 85.6 | 20.2 | forward; 82.7/74.3 |
| Uther | run | 12: Walk 1 | 94.3 | 22.2 | forward; 81.3/93.4 |
| Uther | turn | 13: test | 64.5 | 12.6 | back; 29.7/18.0 |
| Uther | brake | 14: Cinematic Dialogue One | 4.6 | 0.4 | in place; 4.4/0.3 |
| Uther | jump-squat | 15: Attack Slam | 20.3 | 1.5 | down; 15.4/7.5 |
| Uther | roll-forward | 22: CInematic Surprised Two | 12.3 | 3.0 | forward; 5.4/11.5 |
| Uther | roll-back | 23: CInematic Turn90Left One | 40.0 | 16.7 | back; 40.0/16.0 |
| Uther | spot-dodge | 24: Cinematic Turn90Right One | 25.4 | 10.1 | in place; 17.5/24.6 |
| Uther | air-dodge | 16: Spell | 117.9 | 28.1 | in place; 110.2/87.4 |
| Uther | tech | 17: Spell Fast | 84.6 | 28.9 | in place; 84.0/66.4 |
| Uther | tech-forward | 18: Cinematic Walk | 78.1 | 16.7 | forward; 65.1/76.8 |
| Uther | tech-back | 19: Cinematic Salute Two | 210.8 | 20.5 | back; 95.4/193.9 |
| Uther | get-up | 25: CInematicTurn180Left One | 79.8 | 29.5 | up; 22.2/14.3 |
| Uther | get-up-forward | 20: Cinematic Dialogue Two | 60.1 | 10.8 | forward; 36.5/57.9 |
| Uther | get-up-back | 21: Cinematic Surprised One | 33.3 | 10.4 | back; 30.8/8.0 |
| Uther | get-up-attack | 26: Cinematic Turn180Right One | 100.9 | 24.0 | both; 36.2/100.9 |
| Uther | ledge-get-up | 27: Spell Slam | 164.1 | 30.5 | up; 76.5/71.0 |
| Uther | ledge-roll | 28: Uther jab | 33.3 | 6.8 | forward; 25.9/11.1 |
| Uther | ledge-attack | 29: Uther jab2 | 29.8 | 8.4 | both; 27.0/19.1 |
| Dreadlord | walk | 5: Walk | 115.4 | 38.3 | forward; 115.3/109.0 |
| Dreadlord | dash | 5: Walk | 115.7 | 38.0 | forward; 115.7/107.5 |
| Dreadlord | run | 5: Walk | 119.3 | 40.1 | forward; 110.1/107.2 |
| Dreadlord | turn | 12: Recovery turn | 115.8 | 48.2 | back; 75.0/115.3 |
| Dreadlord | brake | 13: Recovery stop | 32.6 | 12.6 | in place; 23.7/32.1 |
| Dreadlord | jump-squat | 14: Recovery jumpSquat | 56.2 | 22.7 | down; 54.5/16.7 |
| Dreadlord | roll-forward | 21: Recovery rollForward | 171.6 | 82.8 | forward; 100.3/125.2 |
| Dreadlord | roll-back | 22: Recovery rollBackward | 171.9 | 83.3 | back; 126.4/97.3 |
| Dreadlord | spot-dodge | 23: Recovery spotDodge | 59.0 | 25.0 | in place; 47.8/39.2 |
| Dreadlord | air-dodge | 15: Recovery airDodge | 58.8 | 22.9 | in place; 42.6/35.1 |
| Dreadlord | tech | 16: Recovery tech | 122.4 | 60.8 | in place; 114.7/77.9 |
| Dreadlord | tech-forward | 17: Recovery techForward | 146.3 | 71.0 | forward; 124.9/130.9 |
| Dreadlord | tech-back | 18: Recovery techBackward | 146.8 | 72.1 | back; 118.7/134.9 |
| Dreadlord | get-up | 24: Recovery getUp | 134.0 | 64.9 | up; 125.3/94.8 |
| Dreadlord | get-up-forward | 19: Recovery getUpRollForward | 146.3 | 70.8 | forward; 124.7/130.8 |
| Dreadlord | get-up-back | 20: Recovery getUpRollBackward | 147.4 | 71.9 | back; 118.7/134.9 |
| Dreadlord | get-up-attack | 25: Recovery getUpAttack | 197.7 | 97.0 | both; 193.7/170.3 |
| Dreadlord | ledge-get-up | 26: Recovery ledgeClimb | 146.1 | 90.2 | up; 136.5/12.4 |
| Dreadlord | ledge-roll | 27: Recovery ledgeRoll | 146.5 | 70.8 | forward; 124.9/130.7 |
| Dreadlord | ledge-attack | 28: Recovery ledgeAttack | 209.7 | 109.2 | both; 203.6/81.6 |
| Shadow Hunter | walk | 0: Walk | 173.2 | 44.3 | forward; 158.1/166.2 |
| Shadow Hunter | dash | 0: Walk | 171.9 | 35.9 | forward; 157.1/164.3 |
| Shadow Hunter | run | 0: Walk | 157.1 | 33.4 | forward; 150.0/130.5 |
| Shadow Hunter | turn | 14: Recovery turn | 133.2 | 48.2 | back; 128.1/133.2 |
| Shadow Hunter | brake | 15: Recovery stop | 26.6 | 10.8 | in place; 15.0/18.5 |
| Shadow Hunter | jump-squat | 16: Recovery jumpSquat | 30.3 | 13.5 | down; 28.6/18.6 |
| Shadow Hunter | roll-forward | 23: Recovery rollForward | 156.4 | 70.5 | forward; 130.9/147.0 |
| Shadow Hunter | roll-back | 24: Recovery rollBackward | 156.5 | 70.7 | back; 147.2/130.8 |
| Shadow Hunter | spot-dodge | 25: Recovery spotDodge | 64.1 | 20.2 | in place; 35.9/34.6 |
| Shadow Hunter | air-dodge | 17: Recovery airDodge | 57.3 | 20.0 | in place; 31.8/31.9 |
| Shadow Hunter | tech | 18: Recovery tech | 118.1 | 48.2 | in place; 110.1/101.8 |
| Shadow Hunter | tech-forward | 19: Recovery techForward | 161.6 | 71.4 | forward; 114.2/120.4 |
| Shadow Hunter | tech-back | 20: Recovery techBackward | 147.7 | 62.4 | back; 115.9/127.1 |
| Shadow Hunter | get-up | 26: Recovery getUp | 125.7 | 48.6 | up; 68.4/105.4 |
| Shadow Hunter | get-up-forward | 21: Recovery getUpRollForward | 161.6 | 71.4 | forward; 114.4/120.2 |
| Shadow Hunter | get-up-back | 22: Recovery getUpRollBackward | 148.0 | 62.2 | back; 115.8/127.1 |
| Shadow Hunter | get-up-attack | 27: Recovery getUpAttack | 262.8 | 105.0 | both; 222.4/138.1 |
| Shadow Hunter | ledge-get-up | 28: Recovery ledgeClimb | 114.2 | 64.6 | up; 95.6/30.7 |
| Shadow Hunter | ledge-roll | 29: Recovery ledgeRoll | 160.8 | 71.5 | forward; 114.4/120.6 |
| Shadow Hunter | ledge-attack | 30: Recovery ledgeAttack | 265.1 | 117.2 | both; 184.2/115.4 |
| Pit Lord | walk | 1: Walk | 103.7 | 21.6 | forward; 99.4/98.7 |
| Pit Lord | dash | 3: Walk Fast | 149.6 | 39.7 | forward; 145.9/91.5 |
| Pit Lord | run | 3: Walk Fast | 158.4 | 40.0 | forward; 158.1/104.0 |
| Pit Lord | turn | 17: Recovery turn | 355.7 | 95.8 | back; 298.0/347.8 |
| Pit Lord | brake | 18: Recovery stop | 158.7 | 43.6 | in place; 59.0/91.4 |
| Pit Lord | jump-squat | 19: Recovery jumpSquat | 160.1 | 40.0 | down; 159.8/111.8 |
| Pit Lord | roll-forward | 26: Recovery rollForward | 355.9 | 162.4 | forward; 288.0/341.3 |
| Pit Lord | roll-back | 27: Recovery rollBackward | 364.5 | 169.6 | back; 344.8/282.3 |
| Pit Lord | spot-dodge | 28: Recovery spotDodge | 152.1 | 76.0 | in place; 96.9/56.0 |
| Pit Lord | air-dodge | 20: Recovery airDodge | 122.0 | 39.4 | in place; 89.6/54.2 |
| Pit Lord | tech | 21: Recovery tech | 313.1 | 91.0 | in place; 153.7/77.6 |
| Pit Lord | tech-forward | 22: Recovery techForward | 385.6 | 161.6 | forward; 251.6/222.9 |
| Pit Lord | tech-back | 23: Recovery techBackward | 359.6 | 157.1 | back; 240.2/197.4 |
| Pit Lord | get-up | 29: Recovery getUp | 305.9 | 92.5 | up; 168.9/297.3 |
| Pit Lord | get-up-forward | 24: Recovery getUpRollForward | 384.7 | 162.0 | forward; 252.3/223.0 |
| Pit Lord | get-up-back | 25: Recovery getUpRollBackward | 359.6 | 156.8 | back; 240.1/196.7 |
| Pit Lord | get-up-attack | 30: Recovery getUpAttack | 336.6 | 160.5 | both; 231.3/332.0 |
| Pit Lord | ledge-get-up | 31: Recovery ledgeClimb | 227.5 | 95.5 | up; 226.6/141.8 |
| Pit Lord | ledge-roll | 32: Recovery ledgeRoll | 383.6 | 161.1 | forward; 252.3/222.9 |
| Pit Lord | ledge-attack | 33: Recovery ledgeAttack | 231.9 | 118.7 | both; 152.7/83.3 |
| Beastmaster | walk | 0: walk | 181.5 | 54.1 | forward; 149.1/180.8 |
| Beastmaster | dash | 0: walk | 181.5 | 53.6 | forward; 148.2/180.8 |
| Beastmaster | run | 0: walk | 181.1 | 49.4 | forward; 159.7/176.1 |
| Beastmaster | turn | 10: Recovery turn | 164.7 | 41.7 | back; 103.9/164.7 |
| Beastmaster | brake | 11: Recovery stop | 33.4 | 23.5 | in place; 21.8/24.2 |
| Beastmaster | jump-squat | 12: Recovery jumpSquat | 57.7 | 34.0 | down; 57.7/13.4 |
| Beastmaster | roll-forward | 19: Recovery rollForward | 187.0 | 91.2 | forward; 101.0/165.1 |
| Beastmaster | roll-back | 20: Recovery rollBackward | 186.8 | 91.4 | back; 165.1/100.8 |
| Beastmaster | spot-dodge | 21: Recovery spotDodge | 74.4 | 37.9 | in place; 41.0/36.9 |
| Beastmaster | air-dodge | 13: Recovery airDodge | 58.6 | 25.4 | in place; 36.7/33.2 |
| Beastmaster | tech | 14: Recovery tech | 123.8 | 60.7 | in place; 106.2/93.5 |
| Beastmaster | tech-forward | 15: Recovery techForward | 146.2 | 80.8 | forward; 120.4/130.3 |
| Beastmaster | tech-back | 16: Recovery techBackward | 150.6 | 75.6 | back; 120.7/126.2 |
| Beastmaster | get-up | 22: Recovery getUp | 123.8 | 61.8 | up; 114.2/103.9 |
| Beastmaster | get-up-forward | 17: Recovery getUpRollForward | 146.3 | 80.4 | forward; 120.3/130.2 |
| Beastmaster | get-up-back | 18: Recovery getUpRollBackward | 150.9 | 75.4 | back; 120.9/126.1 |
| Beastmaster | get-up-attack | 23: Recovery getUpAttack | 271.9 | 97.0 | both; 192.0/164.1 |
| Beastmaster | ledge-get-up | 24: Recovery ledgeClimb | 146.7 | 77.7 | up; 145.7/12.9 |
| Beastmaster | ledge-roll | 25: Recovery ledgeRoll | 146.2 | 80.6 | forward; 120.2/130.2 |
| Beastmaster | ledge-attack | 26: Recovery ledgeAttack | 279.6 | 95.6 | both; 171.8/113.6 |
| Lich King | walk | 2: Walk | 90.9 | 24.8 | forward; 89.3/85.8 |
| Lich King | dash | 10: Walk Fast | 98.4 | 35.4 | forward; 83.5/89.3 |
| Lich King | run | 10: Walk Fast | 143.3 | 41.0 | forward; 141.3/142.7 |
| Lich King | turn | 66: Turn | 72.8 | 19.5 | back; 68.1/40.5 |
| Lich King | brake | 67: Stop | 96.4 | 20.0 | in place; 47.6/69.3 |
| Lich King | jump-squat | 68: Jump Squat | 75.6 | 12.9 | down; 68.0/15.2 |
| Lich King | roll-forward | 33: Roll Forward | 253.1 | 58.7 | forward; 50.7/58.8 |
| Lich King | roll-back | 34: Roll Backward | 75.1 | 30.6 | back; 57.3/63.1 |
| Lich King | spot-dodge | 32: Spot Dodge | 73.5 | 30.6 | in place; 16.7/73.5 |
| Lich King | air-dodge | 35: Air Dodge | 162.1 | 20.4 | in place; 44.9/94.2 |
| Lich King | tech | 69: Tech | 222.7 | 64.2 | in place; 101.6/70.8 |
| Lich King | tech-forward | 70: Tech Forward | 221.9 | 64.9 | forward; 101.5/79.0 |
| Lich King | tech-back | 71: Tech Backward | 224.0 | 68.2 | back; 101.0/118.1 |
| Lich King | get-up | 54: Get Up | 193.2 | 96.9 | up; 185.1/60.1 |
| Lich King | get-up-forward | 72: Get Up Roll Forward | 181.7 | 98.6 | forward; 62.9/149.4 |
| Lich King | get-up-back | 73: Get Up Roll Backward | 183.8 | 103.3 | back; 133.5/68.0 |
| Lich King | get-up-attack | 55: Get Up Attack | 226.1 | 99.6 | both; 80.6/213.9 |
| Lich King | ledge-get-up | 57: Ledge Climb | 249.9 | 43.8 | up; 248.9/72.8 |
| Lich King | ledge-roll | 58: Ledge Roll | 244.7 | 53.5 | forward; 79.4/80.3 |
| Lich King | ledge-attack | 59: Ledge Attack | 283.7 | 51.2 | both; 150.1/170.1 |
| Thrall | walk | 2: Walk | 159.2 | 34.4 | forward; 157.1/139.3 |
| Thrall | dash | 2: Walk | 159.1 | 30.4 | forward; 156.9/100.0 |
| Thrall | run | 2: Walk | 150.0 | 32.3 | forward; 150.0/140.2 |
| Thrall | turn | 29: Thrall turn | 85.9 | 21.5 | back; 77.8/85.7 |
| Thrall | brake | 30: Thrall stop | 45.3 | 16.6 | in place; 14.2/21.9 |
| Thrall | jump-squat | 31: Thrall jumpSquat | 55.7 | 19.0 | down; 7.7/42.5 |
| Thrall | roll-forward | 64: Thrall rollForward | 212.4 | 114.4 | forward; 143.7/201.5 |
| Thrall | roll-back | 68: Thrall rollBackward | 197.4 | 112.2 | back; 180.9/180.4 |
| Thrall | spot-dodge | 45: Thrall spotDodge | 66.4 | 21.2 | in place; 31.7/21.6 |
| Thrall | air-dodge | 26: Thrall airDodge | 45.9 | 14.6 | in place; 24.0/21.2 |
| Thrall | tech | 46: Thrall tech | 131.4 | 52.2 | in place; 61.3/125.5 |
| Thrall | tech-forward | 65: Thrall techForward | 204.9 | 112.4 | forward; 98.4/190.8 |
| Thrall | tech-back | 69: Thrall techBackward | 173.5 | 101.2 | back; 129.2/173.5 |
| Thrall | get-up | 43: Thrall getUp | 108.9 | 41.2 | up; 97.7/26.0 |
| Thrall | get-up-forward | 66: Thrall getUpRollForward | 212.4 | 114.3 | forward; 141.3/201.6 |
| Thrall | get-up-back | 70: Thrall getUpRollBackward | 196.6 | 111.8 | back; 179.2/180.4 |
| Thrall | get-up-attack | 44: Thrall getUpAttack | 96.4 | 20.6 | both; 76.8/92.8 |
| Thrall | ledge-get-up | 39: Thrall ledgeClimb | 131.7 | 37.2 | up; 130.7/32.4 |
| Thrall | ledge-roll | 67: Thrall ledgeRoll | 212.4 | 114.3 | forward; 140.9/201.6 |
| Thrall | ledge-attack | 40: Thrall ledgeAttack | 51.5 | 6.8 | both; 45.8/13.1 |
| Jaina Proudmoore | walk | 6: Walk | 104.8 | 21.9 | forward; 95.9/103.1 |
| Jaina Proudmoore | dash | 6: Walk | 103.9 | 20.9 | forward; 95.4/101.8 |
| Jaina Proudmoore | run | 6: Walk | 67.1 | 15.0 | forward; 57.1/60.5 |
| Jaina Proudmoore | turn | 31: Jaina turn | 69.5 | 14.7 | back; 69.4/56.9 |
| Jaina Proudmoore | brake | 32: Jaina stop | 33.1 | 4.1 | in place; 29.3/19.2 |
| Jaina Proudmoore | jump-squat | 33: Jaina jumpSquat | 59.0 | 9.3 | down; 21.2/42.9 |
| Jaina Proudmoore | roll-forward | 66: Jaina rollForward | 130.2 | 76.0 | forward; 86.9/87.9 |
| Jaina Proudmoore | roll-back | 70: Jaina rollBackward | 129.6 | 76.3 | back; 87.8/86.8 |
| Jaina Proudmoore | spot-dodge | 47: Jaina spotDodge | 39.0 | 9.5 | in place; 37.0/15.5 |
| Jaina Proudmoore | air-dodge | 28: Jaina airDodge | 35.5 | 6.5 | in place; 31.7/11.2 |
| Jaina Proudmoore | tech | 48: Jaina tech | 83.1 | 43.3 | in place; 41.3/82.6 |
| Jaina Proudmoore | tech-forward | 67: Jaina techForward | 129.6 | 74.7 | forward; 87.1/87.9 |
| Jaina Proudmoore | tech-back | 71: Jaina techBackward | 132.0 | 77.4 | back; 88.0/86.9 |
| Jaina Proudmoore | get-up | 45: Jaina getUp | 102.7 | 62.4 | up; 100.6/46.2 |
| Jaina Proudmoore | get-up-forward | 68: Jaina getUpRollForward | 130.4 | 76.1 | forward; 86.8/87.8 |
| Jaina Proudmoore | get-up-back | 72: Jaina getUpRollBackward | 130.0 | 77.6 | back; 87.8/86.6 |
| Jaina Proudmoore | get-up-attack | 46: Jaina getUpAttack | 121.7 | 65.7 | both; 113.0/121.3 |
| Jaina Proudmoore | ledge-get-up | 41: Jaina ledgeClimb | 176.4 | 20.1 | up; 176.0/78.2 |
| Jaina Proudmoore | ledge-roll | 69: Jaina ledgeRoll | 128.9 | 74.8 | forward; 87.0/87.8 |
| Jaina Proudmoore | ledge-attack | 42: Jaina ledgeAttack | 73.7 | 11.0 | both; 54.9/21.8 |
| Sylvanas Windrunner | walk | 8: Walk | 100.5 | 32.0 | forward; 99.8/82.5 |
| Sylvanas Windrunner | dash | 8: Walk | 99.8 | 31.2 | forward; 99.7/81.5 |
| Sylvanas Windrunner | run | 8: Walk | 101.9 | 24.3 | forward; 93.6/98.6 |
| Sylvanas Windrunner | turn | 32: Sylvanas turn | 98.9 | 27.2 | back; 55.2/98.9 |
| Sylvanas Windrunner | brake | 33: Sylvanas stop | 21.7 | 8.5 | in place; 21.3/13.0 |
| Sylvanas Windrunner | jump-squat | 34: Sylvanas jumpSquat | 63.9 | 27.0 | down; 56.7/18.8 |
| Sylvanas Windrunner | roll-forward | 42: Sylvanas rollForward | 142.4 | 66.7 | forward; 70.4/99.2 |
| Sylvanas Windrunner | roll-back | 43: Sylvanas rollBackward | 139.6 | 67.4 | back; 99.7/70.8 |
| Sylvanas Windrunner | spot-dodge | 49: Sylvanas spotDodge | 100.8 | 26.3 | in place; 29.9/78.0 |
| Sylvanas Windrunner | air-dodge | 40: Sylvanas airDodge | 100.9 | 24.6 | in place; 42.2/76.2 |
| Sylvanas Windrunner | tech | 41: Sylvanas tech | 124.8 | 47.5 | in place; 83.7/82.8 |
| Sylvanas Windrunner | tech-forward | 44: Sylvanas techForward | 134.6 | 66.3 | forward; 126.2/99.0 |
| Sylvanas Windrunner | tech-back | 45: Sylvanas techBackward | 143.3 | 59.8 | back; 126.7/107.0 |
| Sylvanas Windrunner | get-up | 51: Sylvanas getUp | 118.5 | 45.3 | up; 112.6/72.3 |
| Sylvanas Windrunner | get-up-forward | 46: Sylvanas getUpRollForward | 134.5 | 66.2 | forward; 126.2/99.2 |
| Sylvanas Windrunner | get-up-back | 47: Sylvanas getUpRollBackward | 143.8 | 59.8 | back; 126.3/106.9 |
| Sylvanas Windrunner | get-up-attack | 52: Sylvanas getUpAttack | 167.8 | 63.5 | both; 118.5/131.5 |
| Sylvanas Windrunner | ledge-get-up | 54: Sylvanas ledgeClimb | 136.1 | 75.8 | up; 128.5/23.9 |
| Sylvanas Windrunner | ledge-roll | 48: Sylvanas ledgeRoll | 135.1 | 66.2 | forward; 126.3/99.3 |
| Sylvanas Windrunner | ledge-attack | 55: Sylvanas ledgeAttack | 167.2 | 81.4 | both; 99.3/134.8 |
| Cairne Bloodhoof | walk | 3: Walk | 109.3 | 40.8 | forward; 100.9/109.1 |
| Cairne Bloodhoof | dash | 3: Walk | 105.1 | 35.3 | forward; 100.3/75.0 |
| Cairne Bloodhoof | run | 3: Walk | 118.4 | 36.0 | forward; 116.8/96.4 |
| Cairne Bloodhoof | turn | 34: Cairne turn | 289.4 | 78.0 | back; 163.5/289.3 |
| Cairne Bloodhoof | brake | 35: Cairne stop | 121.0 | 43.2 | in place; 28.8/15.2 |
| Cairne Bloodhoof | jump-squat | 36: Cairne jumpSquat | 64.3 | 17.5 | down; 26.1/43.2 |
| Cairne Bloodhoof | roll-forward | 69: Cairne rollForward | 284.7 | 130.8 | forward; 275.2/193.7 |
| Cairne Bloodhoof | roll-back | 70: Cairne rollBackward | 285.2 | 131.2 | back; 193.9/275.2 |
| Cairne Bloodhoof | spot-dodge | 50: Cairne spotDodge | 134.8 | 53.5 | in place; 31.5/17.0 |
| Cairne Bloodhoof | air-dodge | 32: Cairne airDodge | 88.1 | 17.5 | in place; 33.5/18.8 |
| Cairne Bloodhoof | tech | 51: Cairne tech | 135.2 | 53.5 | in place; 88.2/98.0 |
| Cairne Bloodhoof | tech-forward | 71: Cairne techForward | 285.3 | 131.4 | forward; 274.8/193.9 |
| Cairne Bloodhoof | tech-back | 72: Cairne techBackward | 285.3 | 131.4 | back; 193.9/274.8 |
| Cairne Bloodhoof | get-up | 48: Cairne getUp | 199.0 | 87.8 | up; 166.6/199.0 |
| Cairne Bloodhoof | get-up-forward | 73: Cairne getUpRollForward | 285.3 | 131.4 | forward; 275.3/193.8 |
| Cairne Bloodhoof | get-up-back | 74: Cairne getUpRollBackward | 285.6 | 131.1 | back; 193.7/275.3 |
| Cairne Bloodhoof | get-up-attack | 49: Cairne getUpAttack | 338.4 | 134.2 | both; 294.0/119.2 |
| Cairne Bloodhoof | ledge-get-up | 44: Cairne ledgeClimb | 113.1 | 45.4 | up; 110.9/59.8 |
| Cairne Bloodhoof | ledge-roll | 75: Cairne ledgeRoll | 285.5 | 131.1 | forward; 275.0/193.8 |
| Cairne Bloodhoof | ledge-attack | 45: Cairne ledgeAttack | 96.2 | 50.3 | both; 95.3/10.7 |
| Chen Stormstout | walk | 0: walk | 116.8 | 40.1 | forward; 116.4/112.8 |
| Chen Stormstout | dash | 0: walk | 116.8 | 37.8 | forward; 116.3/99.7 |
| Chen Stormstout | run | 0: walk | 124.7 | 33.7 | forward; 124.6/107.8 |
| Chen Stormstout | turn | 35: Chen turn | 284.9 | 63.8 | back; 274.9/157.3 |
| Chen Stormstout | brake | 36: Chen stop | 57.0 | 25.0 | in place; 36.2/11.0 |
| Chen Stormstout | jump-squat | 37: Chen jumpSquat | 39.1 | 17.6 | down; 31.1/34.0 |
| Chen Stormstout | roll-forward | 59: Chen rollForward | 305.7 | 123.3 | forward; 143.7/305.6 |
| Chen Stormstout | roll-back | 63: Chen rollBackward | 305.5 | 123.2 | back; 305.1/142.3 |
| Chen Stormstout | spot-dodge | 51: Chen spotDodge | 87.7 | 31.3 | in place; 54.7/33.8 |
| Chen Stormstout | air-dodge | 32: Chen airDodge | 59.9 | 16.9 | in place; 49.0/25.8 |
| Chen Stormstout | tech | 52: Chen tech | 131.3 | 62.5 | in place; 90.3/59.9 |
| Chen Stormstout | tech-forward | 60: Chen techForward | 304.9 | 123.4 | forward; 144.7/304.5 |
| Chen Stormstout | tech-back | 64: Chen techBackward | 304.8 | 123.2 | back; 304.5/143.4 |
| Chen Stormstout | get-up | 49: Chen getUp | 88.2 | 44.2 | up; 87.5/71.0 |
| Chen Stormstout | get-up-forward | 61: Chen getUpRollForward | 305.8 | 123.4 | forward; 143.7/305.7 |
| Chen Stormstout | get-up-back | 65: Chen getUpRollBackward | 305.6 | 123.2 | back; 305.2/142.5 |
| Chen Stormstout | get-up-attack | 50: Chen getUpAttack | 277.9 | 58.2 | both; 152.6/277.8 |
| Chen Stormstout | ledge-get-up | 45: Chen ledgeClimb | 296.6 | 43.8 | up; 209.7/165.1 |
| Chen Stormstout | ledge-roll | 62: Chen ledgeRoll | 305.9 | 123.4 | forward; 143.7/305.5 |
| Chen Stormstout | ledge-attack | 46: Chen ledgeAttack | 64.0 | 16.6 | both; 52.8/18.0 |
| Peon | walk | 1: Walk | 81.7 | 32.3 | forward; 73.2/81.7 |
| Peon | dash | 1: Walk | 81.2 | 31.9 | forward; 71.4/81.2 |
| Peon | run | 1: Walk | 63.1 | 26.5 | forward; 63.1/61.7 |
| Peon | turn | 42: Peon turn | 104.2 | 26.8 | back; 60.5/104.2 |
| Peon | brake | 43: Peon stop | 17.2 | 7.5 | in place; 8.7/13.6 |
| Peon | jump-squat | 44: Peon jumpSquat | 39.0 | 19.5 | down; 34.9/9.3 |
| Peon | roll-forward | 52: Peon rollForward | 107.5 | 58.3 | forward; 51.0/105.9 |
| Peon | roll-back | 53: Peon rollBackward | 108.6 | 57.9 | back; 107.3/51.4 |
| Peon | spot-dodge | 59: Peon spotDodge | 72.4 | 21.9 | in place; 25.9/46.7 |
| Peon | air-dodge | 50: Peon airDodge | 91.7 | 22.0 | in place; 27.1/53.1 |
| Peon | tech | 51: Peon tech | 81.8 | 36.3 | in place; 78.1/39.0 |
| Peon | tech-forward | 54: Peon techForward | 109.4 | 60.4 | forward; 58.2/98.5 |
| Peon | tech-back | 55: Peon techBackward | 110.9 | 55.8 | back; 57.5/100.4 |
| Peon | get-up | 61: Peon getUp | 78.5 | 34.8 | up; 48.4/73.0 |
| Peon | get-up-forward | 56: Peon getUpRollForward | 109.5 | 60.5 | forward; 58.2/98.7 |
| Peon | get-up-back | 57: Peon getUpRollBackward | 111.3 | 55.8 | back; 57.2/100.6 |
| Peon | get-up-attack | 62: Peon getUpAttack | 113.6 | 50.5 | both; 95.2/61.5 |
| Peon | ledge-get-up | 64: Peon ledgeClimb | 103.6 | 63.9 | up; 98.9/1.0 |
| Peon | ledge-roll | 58: Peon ledgeRoll | 109.1 | 60.4 | forward; 58.2/98.8 |
| Peon | ledge-attack | 65: Peon ledgeAttack | 171.7 | 70.6 | both; 71.1/44.3 |
| Goblin Tinker | walk | 0: Walk | 97.4 | 30.3 | forward; 94.3/94.7 |
| Goblin Tinker | dash | 0: Walk | 97.5 | 29.8 | forward; 94.2/93.8 |
| Goblin Tinker | run | 0: Walk | 95.8 | 24.8 | forward; 95.7/65.9 |
| Goblin Tinker | turn | 53: Tinker turn | 152.7 | 41.2 | back; 116.5/152.7 |
| Goblin Tinker | brake | 54: Tinker stop | 32.8 | 14.9 | in place; 25.1/10.6 |
| Goblin Tinker | jump-squat | 55: Tinker jumpSquat | 60.7 | 16.6 | down; 40.5/54.9 |
| Goblin Tinker | roll-forward | 65: Tinker rollForward | 172.0 | 81.7 | forward; 128.7/163.0 |
| Goblin Tinker | roll-back | 66: Tinker rollBackward | 172.0 | 81.4 | back; 162.9/127.8 |
| Goblin Tinker | spot-dodge | 63: Tinker spotDodge | 92.1 | 28.8 | in place; 14.4/60.0 |
| Goblin Tinker | air-dodge | 64: Tinker airDodge | 90.7 | 21.4 | in place; 11.3/64.9 |
| Goblin Tinker | tech | 75: Tinker tech | 137.8 | 57.1 | in place; 90.1/105.0 |
| Goblin Tinker | tech-forward | 67: Tinker techForward | 199.5 | 86.0 | forward; 94.9/191.2 |
| Goblin Tinker | tech-back | 68: Tinker techBackward | 199.0 | 86.0 | back; 191.7/95.7 |
| Goblin Tinker | get-up | 74: Tinker getUp | 126.1 | 58.1 | up; 125.5/92.8 |
| Goblin Tinker | get-up-forward | 69: Tinker getUpRollForward | 199.7 | 85.9 | forward; 95.1/191.2 |
| Goblin Tinker | get-up-back | 70: Tinker getUpRollBackward | 198.8 | 86.0 | back; 191.7/95.7 |
| Goblin Tinker | get-up-attack | 76: Tinker getUpAttack | 208.3 | 77.3 | both; 96.5/175.0 |
| Goblin Tinker | ledge-get-up | 78: Tinker ledgeClimb | 149.0 | 75.6 | up; 125.2/9.4 |
| Goblin Tinker | ledge-roll | 71: Tinker ledgeRoll | 199.7 | 85.9 | forward; 95.1/191.2 |
| Goblin Tinker | ledge-attack | 79: Tinker ledgeAttack | 153.4 | 79.3 | both; 124.5/22.6 |
| Kael'thas Sunstrider | walk | 2: Walk | 92.2 | 25.1 | forward; 90.6/92.2 |
| Kael'thas Sunstrider | dash | 2: Walk | 90.4 | 24.7 | forward; 89.6/90.3 |
| Kael'thas Sunstrider | run | 2: Walk | 99.4 | 21.9 | forward; 96.2/99.4 |
| Kael'thas Sunstrider | turn | 33: Kaelthas turn | 119.5 | 28.3 | back; 68.2/117.4 |
| Kael'thas Sunstrider | brake | 34: Kaelthas stop | 83.3 | 10.3 | in place; 74.9/27.1 |
| Kael'thas Sunstrider | jump-squat | 35: Kaelthas jumpSquat | 55.2 | 13.5 | down; 7.1/41.5 |
| Kael'thas Sunstrider | roll-forward | 68: Kaelthas rollForward | 173.0 | 80.4 | forward; 138.4/96.5 |
| Kael'thas Sunstrider | roll-back | 72: Kaelthas rollBackward | 173.6 | 79.4 | back; 102.5/138.4 |
| Kael'thas Sunstrider | spot-dodge | 49: Kaelthas spotDodge | 92.8 | 11.7 | in place; 79.6/29.8 |
| Kael'thas Sunstrider | air-dodge | 30: Kaelthas airDodge | 87.3 | 9.0 | in place; 77.9/28.3 |
| Kael'thas Sunstrider | tech | 50: Kaelthas tech | 94.2 | 40.3 | in place; 75.8/83.0 |
| Kael'thas Sunstrider | tech-forward | 69: Kaelthas techForward | 172.7 | 78.5 | forward; 138.4/102.6 |
| Kael'thas Sunstrider | tech-back | 73: Kaelthas techBackward | 173.6 | 78.9 | back; 102.6/138.4 |
| Kael'thas Sunstrider | get-up | 47: Kaelthas getUp | 128.7 | 63.4 | up; 104.7/86.2 |
| Kael'thas Sunstrider | get-up-forward | 70: Kaelthas getUpRollForward | 166.4 | 90.6 | forward; 145.9/155.9 |
| Kael'thas Sunstrider | get-up-back | 74: Kaelthas getUpRollBackward | 165.8 | 88.1 | back; 158.1/145.8 |
| Kael'thas Sunstrider | get-up-attack | 48: Kaelthas getUpAttack | 160.8 | 76.6 | both; 141.2/136.0 |
| Kael'thas Sunstrider | ledge-get-up | 43: Kaelthas ledgeClimb | 114.3 | 20.7 | up; 108.5/8.9 |
| Kael'thas Sunstrider | ledge-roll | 71: Kaelthas ledgeRoll | 173.0 | 78.2 | forward; 138.3/102.3 |
| Kael'thas Sunstrider | ledge-attack | 44: Kaelthas ledgeAttack | 68.1 | 11.1 | both; 55.2/19.3 |

Walking/running cadence uses grounded vertices' horizontal excursion twice per cycle. The Lich floats and uses the stock sequence's movement speed. Both measurements use the fighter's displayed model scale.
