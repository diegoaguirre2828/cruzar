'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface B2BNavProps {
  current?: 'sales' | 'console' | 'account';
  lang?: 'en' | 'es';
}

export function B2BNav({ current, lang = 'en' }: B2BNavProps) {
  const pathname = usePathname();
  const active =
    current ??
    (pathname.startsWith('/dispatch/account')
      ? 'account'
      : pathname.startsWith('/dispatch')
        ? 'console'
        : 'sales');
  const es = lang === 'es';
  const linkClass = (on: boolean) =>
    on ? 'text-amber-300' : 'text-white/55 hover:text-amber-300 transition';
  return (
    <nav className="border-b border-white/[0.07] bg-[#070b18]">
      <div className="mx-auto max-w-[1180px] flex items-center gap-5 px-5 sm:px-8 py-3 text-[12px] uppercase tracking-[0.18em]">
        <Link href="/" className="text-white/55 hover:text-amber-300 transition">
          Cruzar
        </Link>
        <span className="text-white/15">/</span>
        <Link href="/insights" className={linkClass(active === 'sales')}>
          {es ? 'Ventas' : 'Sales'}
        </Link>
        <Link href="/dispatch" className={linkClass(active === 'console')}>
          {es ? 'Consola' : 'Console'}
        </Link>
        <Link href="/dispatch/account" className={linkClass(active === 'account')}>
          {es ? 'Cuenta' : 'Account'}
        </Link>
      </div>
    </nav>
  );
}
