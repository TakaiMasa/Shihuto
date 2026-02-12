import AuthProvider from '@/components/auth-provider'
import AuthenticatedShell from '@/components/authenticated-shell'

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AuthProvider>
      <AuthenticatedShell>{children}</AuthenticatedShell>
    </AuthProvider>
  )
}
