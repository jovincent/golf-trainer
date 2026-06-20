// Consistent Overhead Byte Stuffing — ported from the gsp-r10-adapter reference.

export function cobsEncode(input: Uint8Array): Uint8Array {
  const result: number[] = [];
  let distanceIndex = 0;
  let distance = 1;
  for (const b of input) {
    if (b !== 0 && distance < 255) {
      result.push(b);
      distance++;
    } else {
      result.splice(distanceIndex, 0, distance);
      distanceIndex = result.length;
      distance = 1;
    }
  }
  if (result.length !== 255 && result.length > 0) {
    result.splice(distanceIndex, 0, distance);
  }
  return Uint8Array.from(result);
}

export function cobsDecode(input: Uint8Array): Uint8Array {
  const result: number[] = [];
  let i = 0;
  while (i < input.length) {
    const distance = input[i];
    if (input.length < i + distance || distance < 1) return new Uint8Array(0);
    for (let j = 1; j < distance; j++) result.push(input[i + j]);
    i += distance;
    if (distance < 0xff && i < input.length) result.push(0);
  }
  return Uint8Array.from(result);
}
