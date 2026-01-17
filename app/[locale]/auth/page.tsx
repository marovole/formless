import { redirect } from 'next/navigation'

export default async function AuthPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  redirect(`/${locale}/sign-in`)
}
