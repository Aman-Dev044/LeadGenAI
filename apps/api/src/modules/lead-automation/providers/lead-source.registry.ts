import { Injectable } from '@nestjs/common';
import { ILeadSourceProvider } from './lead-source.interface';
import { GooglePlacesProvider } from './google-places.provider';

/**
 * Lookup for the prospecting sources this build supports. Adding a source means
 * writing one provider and listing it here - nothing else changes.
 */
@Injectable()
export class LeadSourceRegistry {
  private readonly providers: ILeadSourceProvider[];

  constructor(private readonly googlePlaces: GooglePlacesProvider) {
    this.providers = [googlePlaces];
  }

  get(id: string): ILeadSourceProvider | undefined {
    return this.providers.find((p) => p.id === id);
  }

  /** Default source used by campaigns that do not pin one. */
  default(): ILeadSourceProvider {
    return this.googlePlaces;
  }

  list() {
    return this.providers.map((p) => ({
      id: p.id,
      label: p.label,
      configured: p.isConfigured(),
    }));
  }
}
