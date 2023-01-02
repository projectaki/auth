export interface HttpService {
  get<T>(url: string, headers?: { [key: string]: string }): Promise<T>;

  post<T>(
    url: string,
    body: any,
    headers?: { [key: string]: string }
  ): Promise<T>;
}
