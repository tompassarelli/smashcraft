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
| Archer | air-dodge | 40: Stand | 26.0 | 3.8 | in place; 17.6/25.9 |
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
| Rifleman | air-dodge | 40: Stand | 6.7 | 3.6 | in place; 3.0/6.1 |
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
| Blademaster | roll-forward | 13: Attack Walk Stand Spin | 252.6 | 38.1 | forward; 252.6/136.4 |
| Blademaster | roll-back | 13: Attack Walk Stand Spin | 252.6 | 38.1 | back; 136.4/252.6 |
| Blademaster | spot-dodge | 1: Stand cinematic | 210.3 | 52.6 | in place; 107.0/145.5 |
| Blademaster | air-dodge | 13: Attack Walk Stand Spin | 252.7 | 38.1 | in place; 252.7/136.6 |
| Blademaster | tech | 9: Stand Ready | 143.1 | 17.0 | in place; 124.5/47.3 |
| Blademaster | tech-forward | 13: Attack Walk Stand Spin | 252.7 | 37.7 | forward; 252.7/90.0 |
| Blademaster | tech-back | 13: Attack Walk Stand Spin | 252.7 | 37.7 | back; 90.0/252.7 |
| Blademaster | get-up | 9: Stand Ready | 143.1 | 17.0 | up; 40.2/70.7 |
| Blademaster | get-up-forward | 13: Attack Walk Stand Spin | 252.4 | 38.1 | forward; 252.4/136.4 |
| Blademaster | get-up-back | 13: Attack Walk Stand Spin | 252.4 | 38.1 | back; 136.4/252.4 |
| Blademaster | get-up-attack | 13: Attack Walk Stand Spin | 252.7 | 38.1 | both; 252.7/136.6 |
| Blademaster | ledge-get-up | 9: Stand Ready | 142.9 | 16.7 | up; 39.7/70.2 |
| Blademaster | ledge-roll | 13: Attack Walk Stand Spin | 252.5 | 38.1 | forward; 252.5/136.6 |
| Blademaster | ledge-attack | 13: Attack Walk Stand Spin | 251.3 | 38.0 | both; 251.3/136.6 |
| Mountain King | walk | 7: Walk | 84.3 | 28.2 | forward; 71.0/79.3 |
| Mountain King | dash | 7: Walk | 82.9 | 27.6 | forward; 70.9/77.8 |
| Mountain King | run | 7: Walk | 83.9 | 25.1 | forward; 78.5/72.4 |
| Mountain King | turn | 7: Walk | 22.9 | 6.6 | back; 17.9/19.3 |
| Mountain King | brake | 7: Walk | 22.8 | 7.4 | in place; 20.7/17.9 |
| Mountain King | jump-squat | 1: Stand Ready | 0.0 | 0.0 | down; 0.0/0.0 |
| Mountain King | roll-forward | 7: Walk | 84.4 | 28.1 | forward; 71.0/79.2 |
| Mountain King | roll-back | 7: Walk | 84.4 | 28.1 | back; 79.2/71.0 |
| Mountain King | spot-dodge | 10: Spell Slam | 118.5 | 28.8 | in place; 109.3/81.0 |
| Mountain King | air-dodge | 3: Stand - 3 | 36.1 | 17.5 | in place; 36.1/9.2 |
| Mountain King | tech | 3: Stand - 3 | 89.1 | 30.3 | in place; 57.0/71.4 |
| Mountain King | tech-forward | 7: Walk | 84.5 | 28.0 | forward; 70.9/79.2 |
| Mountain King | tech-back | 7: Walk | 84.5 | 28.0 | back; 79.2/70.9 |
| Mountain King | get-up | 3: Stand - 3 | 89.0 | 30.4 | up; 88.7/16.5 |
| Mountain King | get-up-forward | 7: Walk | 84.4 | 28.1 | forward; 71.0/79.2 |
| Mountain King | get-up-back | 7: Walk | 84.4 | 28.1 | back; 79.2/71.0 |
| Mountain King | get-up-attack | 6: Attack -2 | 140.7 | 38.3 | both; 86.0/140.6 |
| Mountain King | ledge-get-up | 7: Walk | 84.3 | 28.2 | up; 33.7/40.0 |
| Mountain King | ledge-roll | 7: Walk | 84.5 | 28.1 | forward; 71.0/79.2 |
| Mountain King | ledge-attack | 6: Attack -2 | 140.5 | 38.2 | both; 85.8/140.2 |
| Warden | walk | 2: Walk | 87.6 | 21.6 | forward; 87.4/85.1 |
| Warden | dash | 2: Walk | 87.4 | 20.6 | forward; 86.2/85.0 |
| Warden | run | 2: Walk | 62.0 | 21.3 | forward; 58.4/59.0 |
| Warden | turn | 2: Walk | 38.0 | 14.8 | back; 13.1/21.8 |
| Warden | brake | 2: Walk | 40.5 | 15.7 | in place; 23.7/15.5 |
| Warden | jump-squat | 4: Stand Ready | 0.0 | 0.0 | down; 0.0/0.0 |
| Warden | roll-forward | 2: Walk | 87.5 | 21.3 | forward; 87.2/85.1 |
| Warden | roll-back | 2: Walk | 87.5 | 21.3 | back; 85.1/87.2 |
| Warden | spot-dodge | 10: Dissipate | 388.3 | 349.7 | in place; 113.3/137.1 |
| Warden | air-dodge | 10: Dissipate | 389.5 | 351.0 | in place; 113.6/137.6 |
| Warden | tech | 4: Stand Ready | 23.2 | 5.3 | in place; 22.0/13.8 |
| Warden | tech-forward | 2: Walk | 86.4 | 20.9 | forward; 85.6/85.0 |
| Warden | tech-back | 2: Walk | 86.4 | 20.9 | back; 85.0/85.6 |
| Warden | get-up | 4: Stand Ready | 23.2 | 5.3 | up; 9.1/9.2 |
| Warden | get-up-forward | 2: Walk | 89.1 | 21.6 | forward; 88.6/85.2 |
| Warden | get-up-back | 2: Walk | 89.1 | 21.6 | back; 85.2/88.6 |
| Warden | get-up-attack | 5: Attack - 2 | 170.8 | 41.2 | both; 149.6/159.8 |
| Warden | ledge-get-up | 6: Spell Slam | 226.3 | 104.5 | up; 188.0/40.8 |
| Warden | ledge-roll | 2: Walk | 88.5 | 21.6 | forward; 88.3/85.0 |
| Warden | ledge-attack | 5: Attack - 2 | 170.1 | 41.2 | both; 149.9/158.9 |
| Lich | walk | 4: Walk | 70.7 | 11.0 | forward; 49.7/20.6 |
| Lich | dash | 4: Walk | 57.3 | 9.2 | forward; 45.0/19.5 |
| Lich | run | 4: Walk | 77.1 | 14.1 | forward; 31.6/42.2 |
| Lich | turn | 4: Walk | 22.5 | 3.5 | back; 11.1/13.2 |
| Lich | brake | 4: Walk | 25.3 | 3.9 | in place; 14.7/11.0 |
| Lich | jump-squat | 1: Stand Ready | 0.0 | 0.0 | down; 0.0/0.0 |
| Lich | roll-forward | 4: Walk | 70.6 | 11.2 | forward; 49.7/29.8 |
| Lich | roll-back | 4: Walk | 70.6 | 11.2 | back; 29.8/49.7 |
| Lich | spot-dodge | 5: Stand Channel | 84.2 | 12.9 | in place; 50.5/21.2 |
| Lich | air-dodge | 5: Stand Channel | 84.4 | 13.1 | in place; 50.6/21.4 |
| Lich | tech | 1: Stand Ready | 63.4 | 9.9 | in place; 52.8/25.6 |
| Lich | tech-forward | 4: Walk | 70.8 | 11.0 | forward; 49.5/19.9 |
| Lich | tech-back | 4: Walk | 70.8 | 11.0 | back; 19.9/49.5 |
| Lich | get-up | 1: Stand Ready | 63.3 | 9.9 | up; 44.1/41.2 |
| Lich | get-up-forward | 4: Walk | 70.4 | 11.2 | forward; 49.7/29.7 |
| Lich | get-up-back | 4: Walk | 70.4 | 11.2 | back; 29.7/49.7 |
| Lich | get-up-attack | 6: Attack | 112.5 | 53.0 | both; 62.4/80.2 |
| Lich | ledge-get-up | 4: Walk | 70.0 | 11.1 | up; 36.3/51.4 |
| Lich | ledge-roll | 4: Walk | 70.7 | 11.2 | forward; 49.6/29.4 |
| Lich | ledge-attack | 6: Attack | 112.9 | 53.0 | both; 62.2/80.0 |
| Uther | walk | 12: Walk | 110.1 | 45.9 | forward; 98.7/109.9 |
| Uther | dash | 12: Walk | 110.1 | 44.8 | forward; 98.3/110.0 |
| Uther | run | 12: Walk | 88.1 | 33.6 | forward; 85.9/80.2 |
| Uther | turn | 12: Walk | 39.7 | 15.4 | back; 25.2/15.1 |
| Uther | brake | 12: Walk | 42.9 | 17.8 | in place; 16.7/28.9 |
| Uther | jump-squat | 0: Stand - 1 | 0.8 | 0.0 | down; 0.2/0.2 |
| Uther | roll-forward | 12: Walk | 110.1 | 45.9 | forward; 98.8/110.0 |
| Uther | roll-back | 12: Walk | 110.1 | 45.9 | back; 110.0/98.8 |
| Uther | spot-dodge | 10: Stand Hit | 28.5 | 10.2 | in place; 11.9/20.9 |
| Uther | air-dodge | 0: Stand - 1 | 20.7 | 1.7 | in place; 4.2/16.5 |
| Uther | tech | 3: Stand Ready | 5.8 | 2.5 | in place; 1.7/4.0 |
| Uther | tech-forward | 12: Walk | 110.1 | 45.2 | forward; 98.8/110.0 |
| Uther | tech-back | 12: Walk | 110.1 | 45.2 | back; 110.0/98.8 |
| Uther | get-up | 3: Stand Ready | 5.8 | 2.5 | up; 4.2/5.5 |
| Uther | get-up-forward | 12: Walk | 110.0 | 45.9 | forward; 98.7/109.9 |
| Uther | get-up-back | 12: Walk | 110.0 | 45.9 | back; 109.9/98.7 |
| Uther | get-up-attack | 4: Attack - 1 | 222.9 | 34.9 | both; 218.5/64.3 |
| Uther | ledge-get-up | 12: Walk | 109.8 | 45.7 | up; 66.8/60.9 |
| Uther | ledge-roll | 12: Walk | 110.1 | 45.9 | forward; 98.8/109.9 |
| Uther | ledge-attack | 4: Attack - 1 | 222.9 | 34.9 | both; 218.5/64.0 |
| Dreadlord | walk | 5: Walk | 115.4 | 38.3 | forward; 115.3/109.0 |
| Dreadlord | dash | 5: Walk | 115.7 | 38.0 | forward; 115.7/107.5 |
| Dreadlord | run | 5: Walk | 104.1 | 38.3 | forward; 100.9/102.5 |
| Dreadlord | turn | 5: Walk | 35.5 | 11.5 | back; 22.4/19.3 |
| Dreadlord | brake | 5: Walk | 36.4 | 12.2 | in place; 20.8/23.7 |
| Dreadlord | jump-squat | 1: Stand Ready | 0.0 | 0.0 | down; 0.0/0.0 |
| Dreadlord | roll-forward | 5: Walk | 114.3 | 38.3 | forward; 114.2/109.2 |
| Dreadlord | roll-back | 5: Walk | 114.3 | 38.3 | back; 109.2/114.2 |
| Dreadlord | spot-dodge | 1: Stand Ready | 31.5 | 4.0 | in place; 15.2/28.2 |
| Dreadlord | air-dodge | 2: Stand - 2 | 80.1 | 13.9 | in place; 58.2/80.0 |
| Dreadlord | tech | 1: Stand Ready | 31.6 | 4.0 | in place; 15.2/28.3 |
| Dreadlord | tech-forward | 5: Walk | 115.2 | 37.4 | forward; 115.1/109.4 |
| Dreadlord | tech-back | 5: Walk | 115.2 | 37.4 | back; 109.4/115.1 |
| Dreadlord | get-up | 1: Stand Ready | 31.6 | 4.0 | up; 14.2/12.1 |
| Dreadlord | get-up-forward | 5: Walk | 115.4 | 38.3 | forward; 115.4/109.4 |
| Dreadlord | get-up-back | 5: Walk | 115.4 | 38.3 | back; 109.4/115.4 |
| Dreadlord | get-up-attack | 10: Attack - 2 | 164.6 | 47.9 | both; 109.7/114.4 |
| Dreadlord | ledge-get-up | 6: Spell Slam | 164.0 | 54.2 | up; 156.5/120.1 |
| Dreadlord | ledge-roll | 5: Walk | 115.4 | 38.3 | forward; 115.4/109.2 |
| Dreadlord | ledge-attack | 10: Attack - 2 | 164.8 | 47.9 | both; 109.4/113.7 |
| Shadow Hunter | walk | 0: Walk | 173.2 | 44.3 | forward; 158.1/166.2 |
| Shadow Hunter | dash | 0: Walk | 171.9 | 35.9 | forward; 157.1/164.3 |
| Shadow Hunter | run | 0: Walk | 102.6 | 33.6 | forward; 97.1/100.3 |
| Shadow Hunter | turn | 0: Walk | 47.1 | 16.0 | back; 43.2/29.3 |
| Shadow Hunter | brake | 0: Walk | 52.6 | 17.5 | in place; 32.2/46.1 |
| Shadow Hunter | jump-squat | 7: Stand Ready | 0.0 | 0.0 | down; 0.0/0.0 |
| Shadow Hunter | roll-forward | 0: Walk | 173.0 | 44.3 | forward; 158.2/166.2 |
| Shadow Hunter | roll-back | 0: Walk | 173.0 | 44.3 | back; 166.2/158.2 |
| Shadow Hunter | spot-dodge | 9: Stand  Hit | 161.7 | 63.2 | in place; 67.4/106.2 |
| Shadow Hunter | air-dodge | 9: Stand  Hit | 162.3 | 63.3 | in place; 67.4/106.3 |
| Shadow Hunter | tech | 7: Stand Ready | 13.8 | 3.8 | in place; 3.8/10.4 |
| Shadow Hunter | tech-forward | 0: Walk | 173.3 | 38.8 | forward; 158.2/166.0 |
| Shadow Hunter | tech-back | 0: Walk | 173.3 | 38.8 | back; 166.0/158.2 |
| Shadow Hunter | get-up | 7: Stand Ready | 13.8 | 3.8 | up; 13.8/10.5 |
| Shadow Hunter | get-up-forward | 0: Walk | 172.8 | 44.3 | forward; 157.8/166.5 |
| Shadow Hunter | get-up-back | 0: Walk | 172.8 | 44.3 | back; 166.5/157.8 |
| Shadow Hunter | get-up-attack | 10: Attack | 220.6 | 65.6 | both; 106.4/219.0 |
| Shadow Hunter | ledge-get-up | 0: Walk | 173.2 | 44.2 | up; 94.9/135.1 |
| Shadow Hunter | ledge-roll | 0: Walk | 173.3 | 44.3 | forward; 157.9/166.0 |
| Shadow Hunter | ledge-attack | 10: Attack | 220.1 | 65.4 | both; 105.5/218.7 |
| Pit Lord | walk | 1: Walk | 103.7 | 21.6 | forward; 99.4/98.7 |
| Pit Lord | dash | 3: Walk Fast | 149.6 | 39.7 | forward; 145.9/91.5 |
| Pit Lord | run | 3: Walk Fast | 130.0 | 42.7 | forward; 99.2/129.5 |
| Pit Lord | turn | 1: Walk | 35.7 | 4.0 | back; 11.2/34.5 |
| Pit Lord | brake | 1: Walk | 39.5 | 4.5 | in place; 38.6/12.5 |
| Pit Lord | jump-squat | 2: Stand | 0.0 | 0.0 | down; 0.0/0.0 |
| Pit Lord | roll-forward | 3: Walk Fast | 149.5 | 44.9 | forward; 147.8/122.9 |
| Pit Lord | roll-back | 3: Walk Fast | 149.5 | 44.9 | back; 122.9/147.8 |
| Pit Lord | spot-dodge | 4: Stand - 2 | 80.8 | 6.9 | in place; 26.9/21.6 |
| Pit Lord | air-dodge | 4: Stand - 2 | 81.2 | 7.0 | in place; 26.7/21.6 |
| Pit Lord | tech | 4: Stand - 2 | 81.2 | 6.9 | in place; 26.7/21.5 |
| Pit Lord | tech-forward | 3: Walk Fast | 149.6 | 44.7 | forward; 148.0/122.7 |
| Pit Lord | tech-back | 3: Walk Fast | 149.6 | 44.7 | back; 122.7/148.0 |
| Pit Lord | get-up | 4: Stand - 2 | 81.2 | 6.9 | up; 77.1/7.3 |
| Pit Lord | get-up-forward | 3: Walk Fast | 149.3 | 44.9 | forward; 148.0/122.9 |
| Pit Lord | get-up-back | 3: Walk Fast | 149.3 | 44.9 | back; 122.9/148.0 |
| Pit Lord | get-up-attack | 15: attack - 2 | 413.7 | 65.7 | both; 276.5/399.4 |
| Pit Lord | ledge-get-up | 1: Walk | 103.5 | 21.5 | up; 57.2/57.7 |
| Pit Lord | ledge-roll | 3: Walk Fast | 149.6 | 44.9 | forward; 147.6/122.4 |
| Pit Lord | ledge-attack | 7: Attack | 192.7 | 49.3 | both; 152.5/106.0 |
| Beastmaster | walk | 0: walk | 181.5 | 54.1 | forward; 149.1/180.8 |
| Beastmaster | dash | 0: walk | 181.5 | 53.6 | forward; 148.2/180.8 |
| Beastmaster | run | 0: walk | 119.7 | 42.5 | forward; 103.5/94.2 |
| Beastmaster | turn | 0: walk | 35.5 | 10.4 | back; 34.1/18.3 |
| Beastmaster | brake | 0: walk | 38.2 | 11.5 | in place; 20.6/36.8 |
| Beastmaster | jump-squat | 9: Stand Ready | 0.0 | 0.0 | down; 0.0/0.0 |
| Beastmaster | roll-forward | 0: walk | 181.6 | 54.1 | forward; 149.0/180.9 |
| Beastmaster | roll-back | 0: walk | 181.6 | 54.1 | back; 180.9/149.0 |
| Beastmaster | spot-dodge | 9: Stand Ready | 15.9 | 8.7 | in place; 14.7/2.9 |
| Beastmaster | air-dodge | 9: Stand Ready | 15.9 | 8.7 | in place; 14.7/2.8 |
| Beastmaster | tech | 9: Stand Ready | 15.9 | 8.7 | in place; 14.7/2.9 |
| Beastmaster | tech-forward | 0: walk | 181.6 | 53.9 | forward; 149.2/180.8 |
| Beastmaster | tech-back | 0: walk | 181.6 | 53.9 | back; 180.8/149.2 |
| Beastmaster | get-up | 9: Stand Ready | 15.9 | 8.7 | up; 9.0/12.2 |
| Beastmaster | get-up-forward | 0: walk | 181.7 | 54.1 | forward; 148.9/181.0 |
| Beastmaster | get-up-back | 0: walk | 181.7 | 54.1 | back; 181.0/148.9 |
| Beastmaster | get-up-attack | 4: Attack | 266.9 | 51.1 | both; 118.2/238.5 |
| Beastmaster | ledge-get-up | 0: walk | 181.2 | 53.9 | up; 82.8/93.8 |
| Beastmaster | ledge-roll | 0: walk | 181.6 | 54.0 | forward; 149.2/180.8 |
| Beastmaster | ledge-attack | 4: Attack | 267.6 | 51.1 | both; 113.8/239.1 |
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
| Lich King | get-up-attack | 55: Get Up Attack | 228.6 | 100.3 | both; 64.2/214.0 |
| Lich King | ledge-get-up | 57: Ledge Climb | 249.7 | 43.8 | up; 248.6/72.8 |
| Lich King | ledge-roll | 58: Ledge Roll | 244.1 | 53.4 | forward; 79.2/80.2 |
| Lich King | ledge-attack | 59: Ledge Attack | 283.8 | 51.2 | both; 150.2/170.6 |

Walking/running cadence uses grounded vertices' horizontal excursion twice per cycle. The Lich floats and uses the stock sequence's movement speed. Both measurements use the fighter's displayed model scale.
