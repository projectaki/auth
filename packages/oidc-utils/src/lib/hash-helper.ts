import { KJUR } from 'jsrsasign';
import { hexToBytes } from './encode-helper';

export const sha256 = (str: string, returnType: 'hex' | 'ascii' = 'hex') => {

  const hex = KJUR.crypto.Util.sha256(str);

  const asciiOutput = String.fromCharCode(...hexToBytes(hex));

  return returnType === 'ascii' ? asciiOutput : hex;
};

export const sha256Async = async (str: string) => {
  const encoder = new TextEncoder();

  const data = encoder.encode(str);

  const hash = await crypto.subtle.digest('SHA-256', data);

  const asciiOutput = String.fromCharCode(...Array.from(new Uint8Array(hash)));
  
  return asciiOutput;
};
