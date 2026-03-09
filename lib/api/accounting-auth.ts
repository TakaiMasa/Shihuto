import { NextRequest } from 'next/server'

export function isAuthorizedAccountingRequest(request: NextRequest) {
  const apiKey = process.env.ACCOUNTING_API_KEY
  if (!apiKey) {
    throw new Error('Missing ACCOUNTING_API_KEY')
  }

  const authHeader = request.headers.get('authorization')
  if (!authHeader) return false

  const [type, token] = authHeader.split(' ')
  return type === 'Bearer' && token === apiKey
}
