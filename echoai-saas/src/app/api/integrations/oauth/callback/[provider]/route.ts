import { NextRequest, NextResponse } from 'next/server'
import { OAuth2Manager } from '@/lib/integrations/oauth2-manager'
import { getProvider } from '@/lib/integrations/providers'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  try {
    const { provider: providerName } = await params
    const searchParams = request.nextUrl.searchParams
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const error = searchParams.get('error')

    // Handle OAuth errors
    if (error) {
      const errorDescription = searchParams.get('error_description') || 'OAuth authorization failed'
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_BASE_URL}/dashboard/integrations?error=${encodeURIComponent(errorDescription)}`
      )
    }

    if (!code || !state) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_BASE_URL}/dashboard/integrations?error=Missing authorization code or state`
      )
    }

    const provider = getProvider(providerName)
    if (!provider) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_BASE_URL}/dashboard/integrations?error=Invalid provider`
      )
    }

    const oauth2Manager = new OAuth2Manager()
    const result = await oauth2Manager.exchangeCodeForToken(provider, code, state)

    if (!result) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_BASE_URL}/dashboard/integrations?error=Failed to exchange authorization code`
      )
    }

    // Redirect to integrations page with success message
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_BASE_URL}/dashboard/integrations?success=Integration connected successfully&provider=${provider.name}`
    )
  } catch (error) {
    console.error('OAuth callback error:', error)
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_BASE_URL}/dashboard/integrations?error=${encodeURIComponent(errorMessage)}`
    )
  }
}