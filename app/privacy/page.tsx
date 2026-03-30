import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export const metadata = {
  title: 'Privacy Policy – Cruza',
}

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 pb-16">
        <div className="pt-8 pb-6">
          <Link href="/" className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-700 mb-4">
            <ArrowLeft className="w-3 h-3" /> Back
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Privacy Policy</h1>
          <p className="text-sm text-gray-500 mt-1">Last updated: March 29, 2026</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-6 text-sm text-gray-700 leading-relaxed">

          <section>
            <h2 className="font-bold text-gray-900 mb-2">1. What We Collect</h2>
            <p>When you create an account, we collect your email address and any profile information you choose to provide (name, company, bio). If you use Google sign-in, we receive your name and email from Google.</p>
            <p className="mt-2">When you use the app, we collect driver reports you voluntarily submit, crossings you save, and alert preferences you set.</p>
          </section>

          <section>
            <h2 className="font-bold text-gray-900 mb-2">2. How We Use Your Data</h2>
            <ul className="list-disc pl-4 space-y-1">
              <li>To provide live border wait times and personalized features</li>
              <li>To send you alerts when wait times drop at crossings you follow</li>
              <li>To improve AI predictions using aggregated, anonymous crossing data</li>
              <li>To process subscription payments via Stripe (we never store card details)</li>
            </ul>
          </section>

          <section>
            <h2 className="font-bold text-gray-900 mb-2">3. Advertising</h2>
            <p>Users without an account may see ads served by Google AdSense. Google may use cookies to show relevant ads. You can opt out at <a href="https://adssettings.google.com" className="text-blue-600 underline" target="_blank" rel="noopener">adssettings.google.com</a>. Users with a free account see locally sponsored business ads only. Pro and Business subscribers see no ads.</p>
          </section>

          <section>
            <h2 className="font-bold text-gray-900 mb-2">4. Data Sharing</h2>
            <p>We do not sell your personal data. We share data only with:</p>
            <ul className="list-disc pl-4 mt-2 space-y-1">
              <li><strong>Supabase</strong> — database and authentication provider</li>
              <li><strong>Stripe</strong> — payment processing for subscriptions</li>
              <li><strong>Google AdSense</strong> — ad serving for guest users only</li>
              <li><strong>Vercel</strong> — hosting provider</li>
            </ul>
          </section>

          <section>
            <h2 className="font-bold text-gray-900 mb-2">5. Driver Reports</h2>
            <p>Reports you submit (wait conditions, crossing times) are public and shown to all users. They include your account role but not your name unless you've added it to your profile and set it to visible.</p>
          </section>

          <section>
            <h2 className="font-bold text-gray-900 mb-2">6. Data Retention</h2>
            <p>We retain your account data as long as your account is active. Wait time readings are stored for up to 90 days for historical analysis. You may delete your account at any time by contacting us.</p>
          </section>

          <section>
            <h2 className="font-bold text-gray-900 mb-2">7. Your Rights</h2>
            <p>You may request access to, correction of, or deletion of your personal data at any time. Contact us at <strong>cruzabusiness@gmail.com</strong>.</p>
          </section>

          <section>
            <h2 className="font-bold text-gray-900 mb-2">8. Children</h2>
            <p>Cruza is not directed at children under 13. We do not knowingly collect data from children.</p>
          </section>

          <section>
            <h2 className="font-bold text-gray-900 mb-2">9. Contact</h2>
            <p>Questions? Email us at <strong>cruzabusiness@gmail.com</strong>.</p>
          </section>

        </div>
      </div>
    </main>
  )
}
