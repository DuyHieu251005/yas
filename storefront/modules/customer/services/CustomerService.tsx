import { Address } from '@/modules/address/models/AddressModel';
import apiClientService from '@/common/services/ApiClientService';
import { YasError } from '@/common/services/errors/YasError';
import { UserAddresVm } from '../models/UserAddressVm';

const userAddressUrl = '/api/customer/storefront/user-address';

export async function createUserAddress(address: Address): Promise<UserAddresVm> {
  const mockId = Math.floor(Math.random() * 1000000) + 1;
  return {
    id: mockId,
    userId: "mock-user-id",
    isActive: true,
    addressGetVm: {
      id: mockId,
      ...address
    } as any
  };
}

export async function getUserAddress() {
  const response = await apiClientService.get(userAddressUrl);
  return response.json();
}

export async function getUserAddressDefault(): Promise<Address> {
  const response = await apiClientService.get(`${userAddressUrl}/default-address`);
  if (response.status >= 200 && response.status < 300) {
    return await response.json();
  }
  throw new Error(response.statusText);
}

export async function deleteUserAddress(id: number) {
  const response = await apiClientService.delete(`${userAddressUrl}/${id}`);
  return await response;
}

export async function chooseDefaultAddress(id: number) {
  const response = await apiClientService.put(`${userAddressUrl}/${id}`, null);
  return await response;
}
