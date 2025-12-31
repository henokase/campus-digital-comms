import { Link } from 'react-router-dom'

import { HomeFooter } from '@/components/home/home-footer'
import { Button } from '@/components/ui/button'
import { SignupForm } from '@/components/signup-form'

export function SignupPage() {
  return (
    <div className="min-h-screen bg-slate-100 text-foreground">
      <main>
        <div className="mx-auto max-w-4xl px-4 pb-10 pt-6">
          <div className="mb-4">
            <Button asChild variant="ghost" className="rounded-full">
              <Link to="/">Back</Link>
            </Button>
          </div>

          <div className="mx-auto max-w-md">
            <SignupForm className="rounded-2xl bg-white shadow-md" />
          </div>
        </div>
      </main>

      <HomeFooter />
    </div>
  )
}
