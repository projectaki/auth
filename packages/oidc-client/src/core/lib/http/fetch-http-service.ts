import { HttpService } from "./http-service";

export const createFetchService = (): HttpService => {
  const get = async <T>(
    url: string,
    headers?: { [key: string]: string },
  ): Promise<T> => {
    const response = await fetch(url, {
      method: "GET",
      headers,
    });

    return response.json();
  };

  const post = async <T>(
    url: string,
    body: any,
    headers?: { [key: string]: string },
  ): Promise<T> => {
    const response = await fetch(url, {
      method: "POST",
      headers,
      body,
    });

    return response.json();
  };

  return {
    get,
    post,
  };
};
