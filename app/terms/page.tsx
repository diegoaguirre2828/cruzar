import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export const metadata = {
  title: 'Terms of Service – Cruzar',
}

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 pb-16">
        <div className="pt-8 pb-6">
          <Link href="/" className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-700 mb-4">
            <ArrowLeft className="w-3 h-3" /> Back
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Terms of Service</h1>
          <p className="text-sm text-gray-500 mt-1">Last updated: March 29, 2026</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-6 text-sm text-gray-700 leading-relaxed">

          <section>
            <h2 className="font-bold text-gray-900 mb-2">1. Acceptance</h2>
            <p>By using Cruzar ("the app"), you agree to these terms. If you don't agree, don't use the app.</p>
          </section>

          <section>
            <h2 className="font-bold text-gray-900 mb-2">2. What Cruzar Is</h2>
            <p>Cruzar provides live and estimated US-Mexico border crossing wait times sourced from the US Customs and Border Protection (CBP) public API and crowdsourced driver reports. Wait times are informational only. We are not affiliated with CBP or any government agency.</p>
          </section>

          <section>
            <h2 className="font-bold text-gray-900 mb-2">3. Accuracy Disclaimer</h2>
            <p>Wait times are estimates and may not reflect actual conditions at the time of crossing. Do not rely solely on Cruzar for time-sensitive travel decisions. Cruzar is not responsible for delays, missed appointments, or any consequences of crossing decisions made using this app.</p>
          </section>

          <section>
            <h2 className="font-bold text-gray-900 mb-2">4. User Accounts</h2>
            <p>You are responsible for keeping your login credentials secure. You may not share accounts or use the app for automated scraping. One account per person.</p>
          </section>

          <section>
            <h2 className="font-bold text-gray-900 mb-2">5. Community Reports</h2>
            <p>Reports submitted by users are unverified and community-generated. Cruzar does not guarantee their accuracy. Do not make time-sensitive or safety-critical decisions based solely on community reports. By submitting a report, you grant Cruzar a perpetual, non-exclusive license to display, aggregate, and analyze it. Do not submit false, misleading, or harmful reports. We reserve the right to remove any report without notice.</p>
          </section>

          <section>
            <h2 className="font-bold text-gray-900 mb-2">5a. AI Assistant</h2>
            <p>The Cruzar AI assistant provides general informational responses about border crossing procedures. It is not a licensed immigration attorney and its responses do not constitute legal advice. Do not rely on AI responses for immigration decisions. Always verify information with official sources such as cbp.gov or a licensed immigration attorney. Cruzar is not liable for any consequences arising from reliance on AI-generated responses.</p>
          </section>

          <section>
            <h2 className="font-bold text-gray-900 mb-2">6. Subscriptions & Billing</h2>
            <p>Pro ($2.99/mo) and Business ($49/mo) subscriptions are billed monthly via Stripe. You may cancel anytime from your account page — access continues until the end of the billing period. No refunds are issued for partial months.</p>
          </section>

          <section>
            <h2 className="font-bold text-gray-900 mb-2">7. Advertising</h2>
            <p>Guest users (no account) may see Google AdSense ads. Free account holders may see locally sponsored business ads. Pro and Business subscribers see no ads. We are not responsible for third-party ad content.</p>
          </section>

          <section>
            <h2 className="font-bold text-gray-900 mb-2">8. Data & Analytics</h2>
            <p>Cruzar collects anonymized, aggregated crossing pattern data including wait time trends, traffic volume by time of day, and community-reported conditions. This data does not identify individual users. We may use, analyze, and license this aggregated data to third parties including logistics companies, research institutions, and government agencies. No personally identifiable information is included in any data shared with third parties.</p>
          </section>

          <section>
            <h2 className="font-bold text-gray-900 mb-2">9. Government & Legal Requests</h2>
            <p>Cruzar will comply with lawful government requests, court orders, and subpoenas. We will notify affected users of such requests to the extent permitted by law. We minimize the personal data we retain to limit exposure in such cases.</p>
          </section>

          <section>
            <h2 className="font-bold text-gray-900 mb-2">10. Prohibited Use</h2>
            <ul className="list-disc pl-4 space-y-1">
              <li>Scraping or automated access without written permission</li>
              <li>Submitting false or misleading crossing reports</li>
              <li>Using the app to facilitate any illegal activity</li>
              <li>Attempting to reverse-engineer or compromise the app</li>
              <li>Using the AI assistant to seek advice on evading border regulations</li>
            </ul>
          </section>

          <section>
            <h2 className="font-bold text-gray-900 mb-2">11. Termination</h2>
            <p>We may suspend or terminate accounts that violate these terms. You may delete your account at any time.</p>
          </section>

          <section>
            <h2 className="font-bold text-gray-900 mb-2">12. Limitation of Liability</h2>
            <p>Cruzar is provided "as is." We make no warranties about uptime, accuracy, or fitness for any particular purpose. Our liability to you shall not exceed the amount you paid us in the last 3 months.</p>
          </section>

          <section>
            <h2 className="font-bold text-gray-900 mb-2">13. Governing Law</h2>
            <p>These terms are governed by the laws of the State of Texas, USA.</p>
          </section>

          <section>
            <h2 className="font-bold text-gray-900 mb-2">14. Contact</h2>
            <p>Questions? Email <strong>cruzabusiness@gmail.com</strong>.</p>
          </section>

        </div>
      </div>
    </main>
  )
}
