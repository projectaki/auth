import { Logger } from './logger';

export class DefaultLogger implements Logger {
  log(message: string, ...optionalParams: any[]): void {
    console.log(message, ...optionalParams);
  }

  error(message: string, ...optionalParams: any[]): void {
    console.error(message, ...optionalParams);
  }

  warn(message: string, ...optionalParams: any[]): void {
    console.warn(message, ...optionalParams);
  }
}
