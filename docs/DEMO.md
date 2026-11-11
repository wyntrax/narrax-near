# Demo and submission notes

The hackathon asks for one complete moment, not an architecture tour. Record the real product, keep
the first line understandable to someone who does not know NARRAX, and state NEAR's role concretely.

## Video: 2 minutes 30 seconds

### 0:00–0:20 — The problem

Show the landing page.

> NEAR narrative research is scattered across social posts, DEX data and holder tables. An AI agent
> cannot safely act on that, and a human cannot check it quickly.

Keep this to two sentences. Do not open with a logo animation.

### 0:20–0:45 — What NARRAX is

Show `/radar` and `/tokens`.

> NARRAX joins public conversation to the exact NEP-141 contract, then adds market, holder and risk
> evidence. The radar shows what is forming; the token desk shows what is actually behind it.

Point at one narrative and one token row. Do not read the whole dashboard.

### 0:45–1:30 — One complete moment

Open the `Near` narrative, then a related token, then `/opportunities`.

> This narrative is gaining attention. Here is the token the workspace links to it — and here is the
> evidence: liquidity, holders, concentration, risk flags and the latest observation time. A ticker
> match alone is never enough; the token has to clear the market floors before it is ranked.

Show the opportunity that was produced from the refreshed holder evidence. Say the token name and
score once, not five times.

### 1:30–2:10 — The AI security moment

Open `/agent-risk`.

1. Click **Use example** → `PASS` for NEARLY, with 2,680 holders and 19.1% top-10 concentration.
2. Enter an unknown account id → `UNKNOWN`.
3. Mention that `UNKNOWN` and `BLOCK` are both treated as blocked by the agent policy.

> NARRAX never holds the agent's keys. The agent keeps its wallet and policy; NARRAX only supplies
> the scam and risk evidence. If the evidence is missing or stale, the gate fails closed.

This is the moment the AI Security & Defense track is judged on. Keep it concrete.

### 2:10–2:30 — The thesis evidence and close

Show `THESIS_EVIDENCE.md` or the terminal:

```bash
npm run thesis:report -- --write
```

> The thesis is not a hardcoded opinion. This report is generated from Postgres: narrative-to-token
> conversion, Early Radar outcomes, smart-money observations and collection quality. If the data does
> not support the claim, the report says so.

Close on the repo:

> NARRAX is open source. The public agent risk gate is at `/agent-risk`, and the research workspace
> runs on NEAR mainnet evidence. Link in the post.

## Recording notes

- Use a 16:9 browser window at 1440px or wider.
- Hide bookmarks, terminal history and `.env` contents.
- Use the mainnet research build; testnet has no DEX market feed.
- Keep the mouse still during each narration line.
- Add captions. The first caption should state the problem, not the project name.
- Do not show long setup or install steps. The README covers reproducibility.

## X post draft

The human posts this; the account must say the project was built at NEAR HACKATHON and include the
video or screenshots.

```text
Most NEAR narrative research is scattered across social posts, DEX data and holder tables. We built
NARRAX to join them into one evidence-first desk — and to give AI agents a fail-closed risk check
before they spend.

Built at NEAR HACKATHON.

Demo: <video link>
Repo: https://github.com/wyntrax/narrax-near

@NEARProtocol #NEARHackathon @NearLegion @NearBuilders
```

Reply with one concrete result from the demo:

```text
In the demo, NARRAX checks a real NEAR token before an agent spends: 2,680 holders, 19.1% top-10,
fresh liquidity. The agent gets PASS. An unknown token gets UNKNOWN, which the policy treats as
blocked. NARRAX never holds the keys.
```

## Before submitting

- [ ] Repository is public.
- [ ] CI and Security checks are green on the final `main`.
- [ ] `THESIS_EVIDENCE.md` is regenerated after the final collection window.
- [ ] The demo video is public and the X post is published.
- [ ] The X post says "built at NEAR HACKATHON", tags `@NEARProtocol` and `#NEARHackathon`.
- [ ] Submission tracks are `thesis`, `security`, `open`.
- [ ] The NEAR payout account, team lead, email, team size and consent are confirmed by the human.
- [ ] The submission payload is printed and confirmed before sending.

Do not add placeholder or invented values to the final submission. The human supplies every field.
