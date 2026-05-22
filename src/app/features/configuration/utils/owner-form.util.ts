import { Owner, OwnerPayload } from '../models/owner.model';
import { OwnerFormValue } from '../components/owner-form/owner-form.component';

export function ownerToFormValue(owner: Owner): OwnerFormValue {
  return {
    fullName: owner.full_name ?? '',
    documentNumber: owner.document_number ?? '',
    phoneNumber: owner.phone_number ?? '',
    email: owner.email ?? '',
    address: owner.address ?? '',
    description: owner.description ?? ''
  };
}

export function formValueToOwnerPayload(value: OwnerFormValue): OwnerPayload {
  return {
    full_name: value.fullName.trim(),
    document_number: emptyToNull(value.documentNumber),
    phone_number: emptyToNull(value.phoneNumber),
    email: emptyToNull(value.email),
    address: emptyToNull(value.address),
    description: emptyToNull(value.description)
  };
}

export function formValueToOwnerUpdatePayload(value: OwnerFormValue): Partial<OwnerPayload> {
  return formValueToOwnerPayload(value);
}

function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}
