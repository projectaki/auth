import { HttpService } from './http-service';

export class FetchHttpService implements HttpService {
  async get<T>(url: string, headers?: { [key: string]: string }): Promise<T> {
    const response = await fetch(url, {
      method: 'GET',
      headers,
    });

    return response.json();
  }

  async post<T>(
    url: string,
    body: any,
    headers?: { [key: string]: string }
  ): Promise<T> {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body,
    });

    return response.json();
  }
}
