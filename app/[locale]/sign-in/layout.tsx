import type { Metadata } from 'next'

// The sign-in form is a functional auth page, not indexable content. A layout
// carries the metadata because the page itself is a Client Component and can't
// export `metadata`. Pairs with its removal from the sitemap.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default function SignInLayout({ children }: { children: React.ReactNode }) {
  return children
}
