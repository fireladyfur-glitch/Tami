# Capricornus Living Creator Outreach System

## Purpose

This workflow supports creator discovery and gifting outreach for Capricornus Living hats, earmuffs, and scarves. It is designed for a small, high-fit first wave rather than indiscriminate bulk email.

The offer is a **$100 Capricornus Living gift card** so the creator can choose a suitable accessory. The requested deliverable is one honest short-form video with the verified Capricornus Living account tagged. The creator keeps her own voice and must disclose the gifted relationship according to platform and local rules.

## Brand direction

- Living from Nature. Nature for Living.
- Tactile natural materials, thoughtful winter dressing, quiet confidence, and pieces chosen slowly.
- Warm, direct, considered US-English copy.
- No exaggerated claims, scripted praise, or pressure.

## Discovery policy

Prioritize creators whose public content is about:

- self-described midlife, over-40, or over-50 style;
- winter outfits, cold-weather dressing, texture, and accessories;
- timeless wardrobes, natural materials, sustainable or considered living;
- active short-form posting within the last 14 days;
- credible engagement and audience conversation, even with a modest follower count.

Use only business emails publicly supplied by the creator or an authorized representative. Save the exact source URL and verification date. Never scrape private contact details, buy an unverified list, infer age from appearance, or infer/filter by race or ethnicity.

## Score and tiers

The deterministic score in `src/creatorOutreach.ts` uses:

- sales / GMV history: 30%;
- conversion rate: 20%;
- content fit: 20%;
- engagement rate: 10%;
- posting consistency: 10%;
- activity in the last 14 days: 10%.

Unknown evidence contributes zero and lowers the confidence score. It is never silently guessed.

- S: 85–100
- A: 70–84
- B: 55–69
- C: below 55

Only verified S/A contacts enter the first send wave. The first wave is capped at 30 creators, with no more than 20 new messages per sender per day.

## Email sequence

- D0: personalized relevance + $100 gift-card offer + one low-friction CTA.
- D3: explains that the creator chooses the piece and keeps an honest voice.
- D7: adds the simple creative direction and disclosure expectation.
- D14: closes the loop and suppresses further follow-up.

The first email is plain text and capped at 75 words. It contains an easy opt-out. D3/D7/D14 add new information and never use “Just checking in.”

## Reply automation

Safe deterministic replies may be sent for:

- clear positive interest or a request for selection details;
- a clear decline;
- an unsubscribe request.

Paid-only replies, negotiations, ambiguous questions, complaints, legal/privacy requests, or messages that could create a commercial promise require a human-reviewed draft. Gift cards are created by the operator after the nightly high-intent report.

## Nightly operating cycle — 22:00 Asia/Shanghai

1. Read the private CRM and suppression list.
2. Read the live Shopify accessories collection and confirm the offer still has eligible products.
3. Discover only publicly contactable, content-matched creators.
4. Verify source URL, recent activity, email format, and no prior contact.
5. Score and rank creators; add S/A creators to the first-wave queue.
6. Read incoming replies, classify intent, and update the CRM.
7. Send only when all sender gates below pass; otherwise create drafts.
8. Apply D3/D7/D14 follow-ups only when due.
9. Add declines, unsubscribes, hard bounces, and D14 closes to suppression.
10. Report discovered, verified, sent, replies, positive replies, bounce rate, suppression count, and the high-intent creators needing gift cards.

Pause all new sends when bounce rate exceeds 2%, or when spam/complaint signals appear.

## Sender gates

Automatic Capricornus Living sends remain disabled unless all of these are true:

1. The connected Gmail sender is `capricornusliving@gmail.com` or a verified `@capricornusliving.com` mailbox/alias.
2. SPF, DKIM, and DMARC are configured for the sending domain when a domain mailbox is used.
3. The exact Capricornus Living social handle to tag is verified.
4. The candidate has a current public business-contact source URL.
5. The address is not in suppression and was not contacted by the earlier Firelady campaign unless explicitly approved for reactivation.

The currently connected Gmail account is `fireladyfur@gmail.com`; it is suitable for reading the old campaign and building suppression history, but not for automatic Capricornus Living cold outreach.

## Data locations

- Public code and synthetic tests: this repository.
- Real creator CRM, email addresses, reply history, and suppression data: local private folder only.
- Never commit real creator data, Gmail tokens, API keys, cookies, gift-card codes, or shipping information to this public repository.

