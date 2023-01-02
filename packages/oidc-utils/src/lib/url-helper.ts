export const redirectTo = (url: string) => {
  location.href = url;
};

export const replaceUrlState = (url: string) => {
  history.replaceState({}, '', url);
};

export const getCurrentUrl = () => {
  return location.href;
};

export const getCurrentRoute = () => {
  return location.pathname;
};

export const getCurrentOrigin = () => {
  return location.origin;
};

export const getUrlWithoutParams = () => {
  return getCurrentOrigin() + getCurrentRoute();
};

export const getQueryParams = () => {
  return new URLSearchParams(location.search);
};

export const isHttps = (url: string) => {
  return url.startsWith('https://');
};
