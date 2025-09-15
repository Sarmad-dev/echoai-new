import { LoginForm } from '@/components/auth/login-form'

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <LoginForm />
    </div>
  )
}

export const metadata = {
  title: 'Sign In - EchoAI',
  description: 'Sign in to your EchoAI account',
}