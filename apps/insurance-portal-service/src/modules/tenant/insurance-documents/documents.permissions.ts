export const DocumentsPermissions = {
  READ: 'documents:read',
  UPLOAD: 'documents:upload',
  DOWNLOAD: 'documents:download',
  CREATE_VERSION: 'documents:create-version',
  SHARE_CUSTOMER: 'documents:share-customer',
  SHARE_INTERMEDIARY: 'documents:share-intermediary',
  REVOKE: 'documents:revoke',
  ARCHIVE: 'documents:archive',
  RESCAN: 'documents:rescan',
  READ_ACCESS_HISTORY: 'documents:read-access-history',
  READ_RESTRICTED: 'documents:read-restricted',

  REGISTER: 'documents:register',
  VERIFY: 'documents:verify',
  REJECT: 'documents:reject',
} as const;

export type DocumentsPermission =
  (typeof DocumentsPermissions)[keyof typeof DocumentsPermissions];
