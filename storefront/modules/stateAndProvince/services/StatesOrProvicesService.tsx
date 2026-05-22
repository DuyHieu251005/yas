import { StateOrProvince } from '../models/StateOrProvince';

export async function getStatesOrProvinces(id: number): Promise<StateOrProvince[]> {
  const numId = Number(id);
  if (numId === 1) {
    return [
      { id: 10, name: 'Hanoi' },
      { id: 11, name: 'Ho Chi Minh City' }
    ];
  }
  if (numId === 2) {
    return [
      { id: 20, name: 'California' },
      { id: 21, name: 'New York' }
    ];
  }
  return [];
}
