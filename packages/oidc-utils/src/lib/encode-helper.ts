export const hexToBytes = (hex: string) => {
  const bytes = [];

  for (let c = 0; c < hex.length; c += 2) {
    bytes.push(parseInt(hex.slice(c, c + 2), 16));
  }

  return bytes;
};

export const base64Encode = (str: string) => btoa(str);

export const base64Decode = (str: string) => atob(str);

export const base64UrlEncode = (str: string) =>
  base64Encode(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

export const base64UrlDecode = (str: string) => {
  const padding = str.length % 4;

  const pad = padding > 0 ? new Array(5 - padding).join('=') : '';
  
  return base64Decode(str.replace(/-/g, '+').replace(/_/g, '/') + pad);
};
