# 02 · Shipping Address

## Vietnamese address format

Vietnamese addresses have four levels: Province → District → Ward → Street address. All four are required for delivery. The province/district/ward hierarchy is a strict cascade — never allow a district from a different province.

```text
Tỉnh/Thành phố  (Province / City)      63 options
└── Quận/Huyện  (District)             varies per province (average ~10)
    └── Phường/Xã  (Ward/Commune)       varies per district (average ~15)
        └── Địa chỉ cụ thể  (Street address)    freeform
```

## Province/District/Ward picker

Use a cascading modal picker — NOT three separate dropdowns. Vietnamese users expect a bottom-sheet picker, not inline dropdowns (follows Shopee / Lazada UI patterns).

```ts
// features/checkout/components/address-picker/index.tsx
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { useProvinces } from './use-provinces';
import { useDistricts } from './use-districts';
import { useWards } from './use-wards';

export function AddressPicker({ onSelect }: { onSelect: (addr: AddressSelection) => void }) {
  const [step, setStep] = useState<'province' | 'district' | 'ward'>('province');
  const [selected, setSelected] = useState<Partial<AddressSelection>>({});

  const { data: provinces } = useProvinces();
  const { data: districts } = useDistricts(selected.provinceCode);
  const { data: wards } = useWards(selected.districtCode);

  function handleProvinceSelect(province: Province) {
    // Reset district and ward on province change
    setSelected({ province });
    setStep('district');
  }

  function handleDistrictSelect(district: District) {
    setSelected((prev) => ({ ...prev, district, ward: undefined }));
    setStep('ward');
  }

  function handleWardSelect(ward: Ward) {
    const complete = { ...selected, ward } as AddressSelection;
    onSelect(complete);
  }

  return (
    <BottomSheet>
      {step === 'province' && (
        <ProvinceList provinces={provinces} onSelect={handleProvinceSelect} />
      )}
      {step === 'district' && (
        <DistrictList
          districts={districts}
          onSelect={handleDistrictSelect}
          onBack={() => setStep('province')}
        />
      )}
      {step === 'ward' && (
        <WardList
          wards={wards}
          onSelect={handleWardSelect}
          onBack={() => setStep('district')}
        />
      )}
    </BottomSheet>
  );
}
```

## Province/District/Ward data

Fetch from NestJS once and cache with a long TTL — this data changes at most a few times per decade:

```ts
// features/checkout/server/queries/address-data.ts
export const provincesQuery = {
  queryKey: ['provinces'],
  queryFn: () => api.get<Province[]>('/fo-mobile/stores/:storeId/address/provinces'),
  staleTime: 1000 * 60 * 60 * 24 * 7,   // 7 days
  gcTime: 1000 * 60 * 60 * 24 * 30,     // 30 days (keep in MMKV)
};

export function useDistricts(provinceCode: string | undefined) {
  return useQuery({
    queryKey: ['districts', provinceCode],
    queryFn: () =>
      api.get<District[]>(`/fo-mobile/stores/:storeId/address/districts?provinceCode=${provinceCode}`),
    enabled: !!provinceCode,
    staleTime: 1000 * 60 * 60 * 24 * 7,
  });
}
```

Alternatively — bundle the full province/district/ward dataset as a JSON file in the app. Vietnam has ~63 provinces, ~700 districts, ~10,000 wards. JSON is ~500 KB uncompressed, ~120 KB gzip. Preferable over network calls for offline reliability.

## Address form

```ts
// features/checkout/components/address-form.tsx

const addressSchema = z.object({
  recipientName: z.string().min(2, 'Vui lòng nhập tên người nhận'),
  phone: z
    .string()
    .regex(/^0[0-9]{9}$/, 'Số điện thoại không hợp lệ'),  // 10-digit, starts with 0
  provinceCode: z.string().min(1),
  districtCode: z.string().min(1),
  wardCode: z.string().min(1),
  streetAddress: z.string().min(5, 'Vui lòng nhập địa chỉ cụ thể'),
});

type AddressFormValues = z.infer<typeof addressSchema>;
```

Input configuration for Vietnamese keyboards:

```tsx
<TextInput
  keyboardType="phone-pad"     // numeric keyboard
  inputMode="numeric"
  autoComplete="tel"
  placeholder="Số điện thoại (VD: 0901234567)"
/>
```

## Saved addresses

Users can save multiple addresses. The default address (if any) should be pre-selected:

```ts
// features/checkout/hooks/use-saved-addresses.ts
export function useSavedAddresses() {
  return useQuery({
    queryKey: checkoutQueryKeys.addresses(profileId),
    queryFn: () => api.get<Address[]>(`/fo-mobile/stores/${STORE_ID}/me/addresses`),
  });
}
```

Show saved addresses as selectable cards above the "Add new address" option. Tapping an existing address selects it immediately without opening the picker flow.

## Submitting

```ts
// POST /fo-mobile/stores/:storeId/me/addresses
interface CreateAddressDto {
  recipientName: string;
  phone: string;           // 10 digits, starts with '0'
  provinceCode: string;
  provinceName: string;
  districtCode: string;
  districtName: string;
  wardCode: string;
  wardName: string;
  streetAddress: string;
  isDefault?: boolean;
}
```

After saving, invalidate the addresses query and auto-select the new address as the checkout shipping address.
