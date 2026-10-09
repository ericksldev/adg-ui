import { normalizeUserRoles, UserRole } from './domain.constants';

export enum Permission {
  /** Listar todas las compañías (solo SaaS). */
  COMPANY_READ = 'COMPANY_READ',
  /** Alta / baja global de compañía (solo SaaS). */
  COMPANY_WRITE = 'COMPANY_WRITE',
  /** Ver la compañía del tenant (SaaS o administrador de esa compañía). */
  COMPANY_TENANT_READ = 'COMPANY_TENANT_READ',
  /** Editar la compañía del tenant y pagos (SaaS o administrador de esa compañía). */
  COMPANY_TENANT_WRITE = 'COMPANY_TENANT_WRITE',
  USER_READ = 'USER_READ',
  USER_WRITE = 'USER_WRITE',
  RANCH_READ = 'RANCH_READ',
  /** Crear / editar / eliminar rancho (SaaS y administrador). */
  RANCH_WRITE = 'RANCH_WRITE',
  PADDOCK_READ = 'PADDOCK_READ',
  PADDOCK_WRITE = 'PADDOCK_WRITE',
  OWNER_READ = 'OWNER_READ',
  OWNER_WRITE = 'OWNER_WRITE',
  MEMBERSHIP_READ = 'MEMBERSHIP_READ',
  MEMBERSHIP_WRITE = 'MEMBERSHIP_WRITE',
  ANIMAL_READ = 'ANIMAL_READ',
  ANIMAL_WRITE = 'ANIMAL_WRITE',
  ANIMAL_WORK_SESSION_READ = 'ANIMAL_WORK_SESSION_READ',
  ANIMAL_WORK_SESSION_WRITE = 'ANIMAL_WORK_SESSION_WRITE',
  SAAS_PLAN_READ = 'SAAS_PLAN_READ',
  SAAS_PLAN_WRITE = 'SAAS_PLAN_WRITE',
  TERMS_VERSION_READ = 'TERMS_VERSION_READ',
  TERMS_VERSION_WRITE = 'TERMS_VERSION_WRITE',
  /** Ver candidatos a borrado permanente y la auditoria (solo administrador). */
  RECORD_PURGE_READ = 'RECORD_PURGE_READ',
  /** Borrar de forma permanente un candidato (solo administrador). */
  RECORD_PURGE_WRITE = 'RECORD_PURGE_WRITE',
}

const PERMISSION_ROLE_MAP: Record<Permission, UserRole[]> = {
  [Permission.COMPANY_READ]: ['saas_owner'],
  [Permission.COMPANY_WRITE]: ['saas_owner'],
  [Permission.COMPANY_TENANT_READ]: ['administrator', 'ranch_staff', 'saas_owner'],
  [Permission.COMPANY_TENANT_WRITE]: ['administrator', 'saas_owner'],
  [Permission.USER_READ]: ['administrator', 'saas_owner'],
  [Permission.USER_WRITE]: ['administrator', 'saas_owner'],
  [Permission.RANCH_READ]: ['ranch_staff', 'administrator', 'saas_owner'],
  [Permission.RANCH_WRITE]: ['administrator', 'saas_owner'],
  [Permission.PADDOCK_READ]: ['ranch_staff', 'administrator'],
  [Permission.PADDOCK_WRITE]: ['ranch_staff', 'administrator'],
  [Permission.OWNER_READ]: ['ranch_staff', 'administrator'],
  [Permission.OWNER_WRITE]: ['ranch_staff', 'administrator'],
  [Permission.MEMBERSHIP_READ]: ['administrator', 'saas_owner'],
  [Permission.MEMBERSHIP_WRITE]: ['administrator', 'saas_owner'],
  [Permission.ANIMAL_READ]: ['ranch_staff', 'administrator'],
  [Permission.ANIMAL_WRITE]: ['ranch_staff', 'administrator'],
  [Permission.ANIMAL_WORK_SESSION_READ]: ['ranch_staff', 'administrator'],
  [Permission.ANIMAL_WORK_SESSION_WRITE]: ['ranch_staff', 'administrator'],
  [Permission.SAAS_PLAN_READ]: ['saas_owner'],
  [Permission.SAAS_PLAN_WRITE]: ['saas_owner'],
  [Permission.TERMS_VERSION_READ]: ['saas_owner'],
  [Permission.TERMS_VERSION_WRITE]: ['saas_owner'],
  [Permission.RECORD_PURGE_READ]: ['administrator'],
  [Permission.RECORD_PURGE_WRITE]: ['administrator'],
};

export const hasPermission = (roles: UserRole[] | string[], permission: Permission): boolean => {
  const normalized = normalizeUserRoles(roles);
  const allowedRoles = PERMISSION_ROLE_MAP[permission];
  return normalized.some((role) => allowedRoles.includes(role));
};
