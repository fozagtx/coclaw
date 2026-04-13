export function shortHex(value: string, head = 6, tail = 4): string {
  if (value.length <= head + tail + 2) {
    return value;
  }
  return `${value.slice(0, head)}...${value.slice(-tail)}`;
}

export function prettyJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}
