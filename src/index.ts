export interface Ascii85Options {
  adobe?: boolean;
  maxBytes?: number;
  maxCharacters?: number;
}
export interface Ascii85EncodeOptions extends Ascii85Options {
  zeroCompression?: boolean;
}
export interface Ascii85DecodeOptions extends Ascii85Options {
  whitespace?: 'allow' | 'reject';
  canonicalTail?: boolean;
}
export class Ascii85Error extends Error {
  constructor(
    readonly code: 'invalid' | 'limit' | 'truncated',
    message: string,
  ) {
    super(message);
    this.name = 'Ascii85Error';
  }
}
function invalid(message: string): never {
  throw new Ascii85Error('invalid', message);
}
function config(options: Ascii85Options): { adobe: boolean; bytes: number; characters: number } {
  const adobe = options.adobe ?? false,
    bytes = options.maxBytes ?? 16777216,
    characters = options.maxCharacters ?? 33554432;
  if (typeof adobe !== 'boolean') invalid('adobe must be boolean.');
  if (
    !Number.isSafeInteger(bytes) ||
    bytes < 0 ||
    bytes > 67108864 ||
    !Number.isSafeInteger(characters) ||
    characters < 0 ||
    characters > 134217728
  )
    invalid('Byte/character budgets must be bounded nonnegative safe integers.');
  return { adobe, bytes, characters };
}
function group(value: number): string {
  const digits = new Array<string>(5);
  for (let index = 4; index >= 0; index--) {
    digits[index] = String.fromCharCode((value % 85) + 33);
    value = Math.floor(value / 85);
  }
  return digits.join('');
}
export function encodeAscii85(input: Uint8Array, options: Ascii85EncodeOptions = {}): string {
  if (!(input instanceof Uint8Array)) invalid('Expected Uint8Array.');
  const limits = config(options),
    zero = options.zeroCompression ?? true;
  if (typeof zero !== 'boolean') invalid('zeroCompression must be boolean.');
  if (input.length > limits.bytes) throw new Ascii85Error('limit', 'Input byte budget exceeded.');
  let size = limits.adobe ? 4 : 0,
    chunk = '';
  const chunks: string[] = [];
  if (size > limits.characters)
    throw new Ascii85Error('limit', 'Framing exceeds character budget.');
  if (limits.adobe) chunk = '<~';
  for (let index = 0; index < input.length; index += 4) {
    const count = Math.min(4, input.length - index);
    let value = 0;
    for (let offset = 0; offset < 4; offset++)
      value = value * 256 + (offset < count ? input[index + offset]! : 0);
    const text = zero && count === 4 && value === 0 ? 'z' : group(value).slice(0, count + 1);
    if (text.length > limits.characters - size)
      throw new Ascii85Error('limit', 'Encoded character budget exceeded.');
    size += text.length;
    chunk += text;
    if (chunk.length >= 8192) {
      chunks.push(chunk);
      chunk = '';
    }
  }
  if (limits.adobe) chunk += '~>';
  chunks.push(chunk);
  return chunks.join('');
}
export function decodeAscii85(text: string, options: Ascii85DecodeOptions = {}): Uint8Array {
  if (typeof text !== 'string') invalid('Expected ASCII85 text.');
  const limits = config(options),
    whitespace = options.whitespace ?? 'allow',
    canonical = options.canonicalTail ?? true;
  if (whitespace !== 'allow' && whitespace !== 'reject') invalid('Unsupported whitespace policy.');
  if (typeof canonical !== 'boolean') invalid('canonicalTail must be boolean.');
  if (text.length > limits.characters)
    throw new Ascii85Error('limit', 'Encoded character budget exceeded.');
  let start = 0,
    end = text.length;
  if (limits.adobe) {
    if (!text.startsWith('<~') || !text.endsWith('~>'))
      invalid('Adobe framing must exactly enclose the input.');
    start = 2;
    end -= 2;
  }
  let size = 0;
  const visit = (write?: (value: number, count: number) => void): void => {
    let value = 0,
      digits = 0,
      original = '';
    const emit = (number: number, count: number): void => {
      if (count > limits.bytes - size)
        throw new Ascii85Error('limit', 'Decoded byte budget exceeded.');
      size += count;
      write?.(number, count);
    };
    for (let index = start; index < end; index++) {
      const code = text.charCodeAt(index);
      if ([9, 10, 12, 13, 32].includes(code)) {
        if (whitespace === 'reject') invalid('Whitespace forbidden.');
        continue;
      }
      if (code === 122) {
        if (digits) invalid('z abbreviation must begin at a group boundary.');
        emit(0, 4);
        continue;
      }
      if (code < 33 || code > 117)
        invalid('Invalid ASCII85 character; y/foldspaces/Z85/RFC1924 are unsupported.');
      value = value * 85 + code - 33;
      original += text[index]!;
      digits++;
      if (digits === 5) {
        if (value > 4294967295) invalid('ASCII85 group exceeds32-bit width.');
        emit(value, 4);
        value = 0;
        digits = 0;
        original = '';
      }
    }
    if (digits === 1)
      throw new Ascii85Error('truncated', 'An ASCII85 tail needs at least two digits.');
    if (digits) {
      for (let index = digits; index < 5; index++) value = value * 85 + 84;
      if (value > 4294967295) invalid('ASCII85 tail exceeds32-bit width.');
      const count = digits - 1,
        factor = 256 ** (4 - count),
        truncated = Math.floor(value / factor) * factor;
      if (canonical && group(truncated).slice(0, digits) !== original)
        invalid('Noncanonical ASCII85 tail.');
      emit(value, count);
    }
  };
  visit();
  const output = new Uint8Array(size);
  size = 0;
  let at = 0;
  visit((value, count) => {
    for (let index = 0; index < count; index++)
      output[at++] = Math.floor(value / 256 ** (3 - index)) % 256;
  });
  return output;
}
