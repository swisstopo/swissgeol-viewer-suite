import { ClientConfig } from './client-config';
import { API_BY_PAGE_HOST } from '../constants';

export class ConfigService {
  private readonly apiUrl: string;

  constructor() {
    this.apiUrl = API_BY_PAGE_HOST[window.location.host];
  }

  async getConfig(): Promise<ClientConfig> {
    const response = await fetch(`${this.apiUrl}/client-config`, {
      method: 'GET',
    });
    if (!response.ok) {
      throw new Error(
        `Failed to fetch client-config: [HTTP ${response.status}] ${await response.text()}`,
      );
    }
    return (await response.json()) as ClientConfig;
  }
}
