import { Country } from '../models/Country';

export async function getCountries(): Promise<Country[]> {
  return [
    { id: 1, name: 'Vietnam' },
    { id: 2, name: 'United States' }
  ];
}
