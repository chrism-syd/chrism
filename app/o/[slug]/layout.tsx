import { getLocalPageTheme, LocalPageThemeStyle } from '@/lib/local-pages/themes'

const councilRouteTheme = getLocalPageTheme({ organizationTypeCode: 'knights_of_columbus' })

export default function PublicLocalOrganizationLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <LocalPageThemeStyle theme={councilRouteTheme} />
    </>
  )
}
