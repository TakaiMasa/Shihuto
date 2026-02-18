import AuthProvider from '@/components/auth-provider'
import AuthenticatedShell from '@/components/authenticated-shell'
import PwaInstallPrompt from '@/components/pwa-install-prompt'

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AuthProvider>
      <AuthenticatedShell>{children}</AuthenticatedShell>
      <PwaInstallPrompt />
    </AuthProvider>
  )
}
