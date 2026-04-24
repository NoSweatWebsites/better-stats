'use client'

import { OrganizationList } from '@clerk/nextjs'

export function OrgPicker() {
  return (
    <OrganizationList
      hidePersonal
      afterSelectOrganizationUrl="/dashboard"
      afterCreateOrganizationUrl="/dashboard"
    />
  )
}
