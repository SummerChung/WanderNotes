export interface TravelMemo {
  id: string;
  uid: string;
  country: string;
  content: string;
  updatedAt: number;
}

export interface CountryInfo {
  name: string;
  code: string;
  flag: string;
}
