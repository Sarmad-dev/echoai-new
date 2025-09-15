import { SignupForm } from '@/components/auth/signup-form'

export default function SignupPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <SignupForm />
    </div>
  )
}

export const metadata = {
  title: 'Create Account - EchoAI',
  description: 'Create your EchoAI account',
}