import { readFile, writeFile } from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const envPath = path.join(__dirname, '.env')

const userToken = process.argv[2]
if (!userToken) {
  console.log('Usage: node gettoken.mjs YOUR_USER_TOKEN')
  console.log('\nGet your user token from: https://developers.facebook.com/tools/explorer/')
  console.log('(Copy the token from the ACCESS TOKEN field at the top of the page)')
  process.exit(1)
}

console.log('🔍 Fetching your Facebook Pages...')
const res = await fetch(`https://graph.facebook.com/me/accounts?access_token=${userToken}`)
const data = await res.json()

if (data.error) {
  console.error('❌ Error:', data.error.message)
  process.exit(1)
}

if (!data.data?.length) {
  console.error('❌ No pages found on this account')
  process.exit(1)
}

console.log('\nPages found:')
data.data.forEach((p, i) => console.log(`  ${i + 1}. ${p.name} (${p.id})`))

// Find Cruzar page by ID or just take first
const envContent = await readFile(envPath, 'utf8')
const pageIdMatch = envContent.match(/FACEBOOK_PAGE_ID=(.+)/)
const pageId = pageIdMatch?.[1]?.trim()

const page = data.data.find(p => p.id === pageId) || data.data[0]
console.log(`\n✅ Using page: ${page.name}`)

// Update .env
const updated = envContent
  .replace(/FACEBOOK_PAGE_TOKEN=.*/, `FACEBOOK_PAGE_TOKEN=${page.access_token}`)
  .replace(/FACEBOOK_PAGE_ID=.*/, `FACEBOOK_PAGE_ID=${page.id}`)

await writeFile(envPath, updated)
console.log('✅ .env updated with fresh page token!')
console.log('\nRun: node render.mjs')
