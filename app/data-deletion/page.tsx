import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export const metadata = {
  title: 'Data Deletion – Cruzar',
}

export default function DataDeletionPage() {
  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 pb-16">
        <div className="pt-8 pb-6">
          <Link href="/" className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-700 mb-4">
            <ArrowLeft className="w-3 h-3" /> Back
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Data Deletion Instructions</h1>
          <p className="text-sm text-gray-500 mt-1">How to delete your Cruzar account and personal data</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-6 text-sm text-gray-700 leading-relaxed">

          <section>
            <h2 className="font-bold text-gray-900 mb-2">Delete Your Account</h2>
            <p>You can request deletion of your Cruzar account and all associated personal data at any time. There are two ways to do this:</p>
          </section>

          <section>
            <h2 className="font-bold text-gray-900 mb-2">Option 1 — Email Request</h2>
            <p>Send an email to <strong>cruzabusiness@gmail.com</strong> with the subject line <strong>"Delete My Account"</strong> from the email address associated with your Cruzar account.</p>
            <p className="mt-2">We will permanently delete your account, profile, saved crossings, alert preferences, and any reports tied to your account within <strong>7 business days</strong> and confirm by email.</p>
          </section>

          <section>
            <h2 className="font-bold text-gray-900 mb-2">Option 2 — In-App Deletion</h2>
            <p>If you signed in with Facebook, you can also revoke Cruzar's access from your Facebook account:</p>
            <ol className="list-decimal pl-4 mt-2 space-y-1">
              <li>Go to <strong>Facebook → Settings & Privacy → Settings → Apps and Websites</strong></li>
              <li>Find <strong>Cruzar</strong> in the list of active apps</li>
              <li>Click <strong>Remove</strong></li>
            </ol>
            <p className="mt-2">Removing the app stops Cruzar from accessing your Facebook data going forward. To also delete data we already stored, please follow Option 1.</p>
          </section>

          <section>
            <h2 className="font-bold text-gray-900 mb-2">What Gets Deleted</h2>
            <ul className="list-disc pl-4 space-y-1">
              <li>Your account and profile (name, email, display name)</li>
              <li>Saved crossings and alert preferences</li>
              <li>Push notification subscriptions</li>
              <li>Personal identifiers attached to crossing reports</li>
              <li>Subscription records (after final billing reconciliation)</li>
            </ul>
          </section>

          <section>
            <h2 className="font-bold text-gray-900 mb-2">What May Be Retained</h2>
            <p>Anonymized, aggregated wait time data (with no link to your identity) may be retained for historical analysis and to improve predictions for all users. This data cannot be used to identify you.</p>
          </section>

          <section>
            <h2 className="font-bold text-gray-900 mb-2">Questions</h2>
            <p>If you have any questions about data deletion, contact us at <strong>cruzabusiness@gmail.com</strong>.</p>
          </section>

        </div>
      </div>
    </main>
  )
}
