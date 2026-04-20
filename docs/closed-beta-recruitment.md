# Cruzar Closed Beta — 12-Tester Recruitment Kit

Everything you need to land 12+ Play Store closed-test testers in 2-3 days.

## Step 1 — Create the Google Group (5 min, do first)

1. Open https://groups.google.com → sign in with `diegonaguirre369@gmail.com` (your Play Console Google account — important)
2. Click **Create group** (top-left)
3. Fill in:
   - **Group name:** `Cruzar Testers`
   - **Group email:** `cruzar-testers` (the full address becomes `cruzar-testers@googlegroups.com`)
   - **Group description:** `Android beta testers for Cruzar — live border wait times`
4. **Privacy settings:**
   - Who can join the group: **Anyone on the web can ask** (lets people self-request via link)
   - Who can view conversations: **Group members**
   - Who can post: **Group members** (default)
5. Click **Create group**
6. Copy the join link — will look like `https://groups.google.com/g/cruzar-testers`. Save it.

**Why Google Group not a raw email list:** Play Console takes a single Google Group email as the "tester list." Add the group once, every person who joins the group auto-becomes a tester. Zero management.

## Step 2 — Post in your FB groups (Spanish)

Drop this in each RGV border group + on the Cruzar FB page. Casual RGV voice, no emojis, straightforward ask.

```
Pa los que usan Cruzar y tienen Android —

Google me pide 12 testers por 14 días pa poder sacar el app en el Play Store. Si me ayudas con eso, te regalo Pro de por vida. Cámaras en vivo, alertas push, patrones históricos, todo.

Lo único que haces:
1. Te metes al grupo: https://groups.google.com/g/cruzar-testers
2. En unos días te llega el link pa instalar desde el Play Store
3. Lo dejas instalado 14 días seguidos (si lo desinstalas se reinicia la cuenta)
4. Al día 15 ya puedo sacarlo pal público

Los primeros 12 que se metan se la llevan. Gracias banda.
```

## Step 3 — Personal ask to family/friends

Copy-paste via WhatsApp / iMessage / Cashapp chat, one by one. Spanish for most, English if they prefer.

### Spanish version

```
Oye, una rapida — me puedes ayudar con algo?

Saque el app que te platique (Cruzar — tiempos de espera de los puentes). Google me pide 12 testers por 14 dias pa poder publicarlo en el Play Store.

Si tienes Android + 5 minutos:
1. Metete aqui https://groups.google.com/g/cruzar-testers
2. En unos dias te mando el link pa instalar
3. Lo dejas 14 dias y ya
4. Te regalo Pro de por vida (te deja ver las camaras en vivo, alertas, todo)

Nomas necesito 12. Tu opinion.
```

### English version

```
Quick one — can you help me with something?

I'm launching the app I mentioned (Cruzar — live border wait times). Google requires 12 testers for 14 days before they'll let me publish on the Play Store.

If you have an Android + 5 minutes:
1. Join this group: https://groups.google.com/g/cruzar-testers
2. I'll send you the install link in a few days
3. Keep it installed for 14 days
4. I give you lifetime Pro (live bridge cameras, alerts, all of it)

Just need 12. Let me know.
```

## Step 4 — Reach engaged Pro users (15-20 unique)

Your most engaged users are the 27 who have `saved_crossings` or active `alert_preferences`. They already committed to your product — high conversion rate. Reach out individually via the contact email they signed up with, not a blast.

### Message to engaged Pro users (bilingual, pick the language the user was set to)

```
Hey — Diego from Cruzar.

Te quiero pedir un favor corto. Estoy a punto de publicar el app en el
Play Store y Google me pide 12 testers por 14 dias. Tu ya eres uno de
mis usuarios mas activos — te gustaria ayudarme?

Lo que haces:
1. Te metes al grupo https://groups.google.com/g/cruzar-testers
2. En unos dias te mando el link pa instalar
3. Lo dejas instalado 14 dias

Tu Pro ya no expira (eres de los primeros 1000 que se la llevan de por
vida), pero si me ayudas con el beta test tambien te pongo en la seccion
de creditos del app y te mando un mensaje cuando salga publicamente.

Gracias por usar Cruzar. Cualquier duda aqui estoy.

— Diego
```

## Step 5 — After you have 12+ in the group

Once you have a real Android phone + Play Console device verification done:

1. Go to Play Console → your Cruzar app → **Testing → Closed testing → Create track**
2. Track name: `internal-beta-v1`
3. Upload `Cruzar.aab` (from `C:\Users\dnawa\OneDrive\Cruzar-TWA-KEYSTORE-BACKUP\`)
4. **Testers → Add Google Group email:** `cruzar-testers@googlegroups.com`
5. Add release notes from `android/store-listing.md`
6. **Save + Review release → Start rollout to closed testing**
7. Play Console gives you an **opt-in URL** — copy it
8. Email the opt-in URL to the Google Group (one email reaches every member)
9. Wait for testers to click → install → 14 days from their install date

## Step 6 — Track progress

Play Console → Testing → Closed testing → **Testers** tab shows:
- How many opted in
- How many actually installed
- Install dates (the 14-day clock starts per-user at install)

You need **12 people who installed 14 days ago** to apply for Production access. If you get 20 in the group, aim for 15 installs as buffer against opt-outs.

## Timeline (realistic)

| Day | Action |
|---|---|
| Today (2026-04-20) | Create Google Group + FB posts + personal asks |
| Day 2-3 | Hit 12+ joiners |
| Day X (Android device available) | Play Console device verification + closed test setup + send opt-in link |
| Day X+1-2 | Testers install |
| Day X+15 | Apply for Production access |
| Day X+16-22 | Google reviews (≤7 days) |
| Day X+22 | Public Play Store listing goes live → Claude flips `NEXT_PUBLIC_TWA_PLAY_STORE_URL` env |

Soonest public launch if you move fast: ~**May 10, 2026**.

## Tester commitments to respect

- **Once they install, they must leave it installed 14 consecutive days.** If they uninstall + reinstall, their clock restarts. Be upfront about this in every message.
- **Lifetime Pro** is the promised reward. When you add them as testers in Play Console, also add them to `promo_first_1000_until` = year 2126 via the admin Accounts tab (or ask Claude to run it — it's one SQL update per user).
- **Credits mention** for the 12 testers in a future app-store update — cheap commitment, high goodwill.

## Files already in place

- `android/store-listing.md` — all Play Console field copy, EN + ES
- `android/play-console-quick-ship.md` — click-by-click form walkthrough
- `android/README.md` — PWABuilder + TWA background
- `C:\Users\dnawa\OneDrive\Cruzar-TWA-KEYSTORE-BACKUP\Cruzar.aab` — signed bundle ready to upload
- `public/.well-known/assetlinks.json` — real SHA256 live, TWA will launch fullscreen
- `public/feature-graphic-1024x500.png` — Play Store feature graphic
