import { PageHeader } from "@/components/layout/PageHeader"
import { PageLayout } from "@/components/layout/PageLayout"
import { ChangePasswordForm } from "@/components/settings/ChangePasswordForm"

export function SettingsScreen() {
  return (
    <PageLayout width="form" spacing="relaxed">
      <PageHeader
        title="Settings"
        description="Manage your account and keep it secure."
      />
      <ChangePasswordForm />
    </PageLayout>
  )
}
