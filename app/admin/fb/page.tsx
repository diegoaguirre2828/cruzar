import { Metadata } from 'next'
import FBPanelClient from './Client'

export const metadata: Metadata = {
  title: 'FB Page Publisher · Admin · Cruzar',
}

export default function AdminFBPage() {
  return <FBPanelClient />
}
