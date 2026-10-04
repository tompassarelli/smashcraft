local function bits(value) return string.format('%08x', string.unpack('I4', string.pack('f', value))) end
local gravity = 0.17000000178813934
local velocity = 0.0
local scaledVelocity = 0.0
for frame = 1, 10 do
 velocity = velocity - gravity
 scaledVelocity = ((scaledVelocity / 6.0) - ((gravity * 6.0) / 6.0)) * 6.0
 print(frame, bits(velocity), bits(scaledVelocity / 6.0), bits(velocity * 6.0), bits(scaledVelocity))
end
