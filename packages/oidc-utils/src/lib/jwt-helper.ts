import { base64UrlDecode } from './encode-helper';
import { JWT } from './models';

export const decodeJWt = (jwt: string): JWT => {
  const parts = jwt.split('.');

  if (parts.length !== 3) {
    throw new Error('Invalid JWT');
  }

  try {
    const header = JSON.parse(base64UrlDecode(parts[0]));

    const payload = JSON.parse(base64UrlDecode(parts[1]));

    const signature = parts[2];
    
    return { header, payload, signature };
  } catch (e) {
    throw new Error('Id token is an invalid JWT, couldnt decode it');
  }
};
