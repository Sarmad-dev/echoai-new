import { NextRequest, NextResponse } from 'next/server'
import { OAuth2Manager } from '@/lib/integrations/oauth2-manager'
import { getProvider } from '@/lib/integrations/providers'
import { createClient } from '@/lib/supabase/supabase'

export async function POST(request: NextRequest) {
  try {
    const { provider: providerId, userId } = await request.json()

    if (!providerId || !userId) {
      return NextResponse.json(
        { error: 'Provider and userId are required' },
        { status: 400 }
      )
    }

    const provider = getProvider(providerId)
    if (!provider) {
      return NextResponse.json(
        { error: 'Invalid provider' },
        { status: 400 }
      )
    }

    // Validate that the user exists and is authenticated
    const supabase = createClient()
    const { data: user, error: userError } = await supabase
      .from('User')
      .select('id')
      .eq('id', userId)
      .single()

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Invalid user' },
        { status: 401 }
      )
    }

    const oauth2Manager = new OAuth2Manager()
    const authUrl = await oauth2Manager.generateAuthUrl(provider, userId)

    return NextResponse.json({ authUrl })
  } catch (error) {
    console.error('OAuth authorization error:', error)
    return NextResponse.json(
      { error: 'Failed to generate authorization URL' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const provider = searchParams.get('provider')
  const userId = searchParams.get('userId')

  if (!provider || !userId) {
    return NextResponse.json(
      { error: 'Provider and userId are required' },
      { status: 400 }
    )
  }

  try {
    const providerConfig = getProvider(provider)
    if (!providerConfig) {
      return NextResponse.json(
        { error: 'Invalid provider' },
        { status: 400 }
      )
    }

    const oauth2Manager = new OAuth2Manager()
    const authUrl = await oauth2Manager.generateAuthUrl(providerConfig, userId)

    // Redirect to the OAuth provider
    return NextResponse.redirect(authUrl)
  } catch (error) {
    console.error('OAuth authorization error:', error)
    return NextResponse.json(
      { error: 'Failed to generate authorization URL' },
      { status: 500 }
    )
  }
}