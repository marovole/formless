import type { Metadata } from 'next'

// The sign-up form is a functional auth page, not indexable content. A layout
// carries the metadata because the page itself is a Client Component and can't
// export `metadata`.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default function SignUpLayout({ children }: { children: React.ReactNode }) {
  return children
}
