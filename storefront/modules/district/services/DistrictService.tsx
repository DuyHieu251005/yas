import { District } from '../models/District';

export async function getDistricts(id: number): Promise<District[]> {
  const numId = Number(id);
  if (numId === 10) {
    return [
      { id: 100, name: 'Hoan Kiem District' },
      { id: 101, name: 'Ba Dinh District' }
    ];
  }
  if (numId === 11) {
    return [
      { id: 110, name: 'District 1' },
      { id: 111, name: 'District 3' }
    ];
  }
  if (numId === 20) {
    return [
      { id: 200, name: 'Los Angeles' },
      { id: 201, name: 'San Francisco' }
    ];
  }
  if (numId === 21) {
    return [
      { id: 210, name: 'Manhattan' },
      { id: 211, name: 'Brooklyn' }
    ];
  }
  return [];
}
