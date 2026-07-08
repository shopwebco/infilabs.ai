# DATA_MODEL.md — Xenon

Authoritative Prisma schema (starting point — evolve via migrations, keep this doc in sync).

```prisma
generator client { provider = "prisma-client-js" }
datasource db { provider = "postgresql"; url = env("DATABASE_URL") }

enum PlatformRole { USER PLATFORM_ADMIN }
enum WorkspaceRole { ADMIN MANAGER STAFF }
enum Plan { STARTER PRO AGENCY ENTERPRISE }
enum ApprovalStatus { PENDING APPROVED DECLINED EXPIRED }
enum WorkStatus { DRAFT IN_REVIEW APPROVED PUBLISHED }
enum ActionActor { AGENT STAFF MANAGER ADMIN SYSTEM }
enum InvoiceStatus { DRAFT OPEN PAID VOID OVERDUE }
enum IntegrationProvider { AMAZON WALMART TIKTOK SHOPIFY }
enum IntegrationStatus { CONNECTED ERROR DISCONNECTED }

model User {
  id            String   @id @default(cuid())
  email         String   @unique
  name          String?
  passwordHash  String?                    // null if OAuth-only
  platformRole  PlatformRole @default(USER)
  plan          Plan     @default(STARTER)
  stripeCustomerId String? @unique
  memberships   Membership[]
  agentUsage    AgentUsage[]
  createdAt     DateTime @default(now())
}

model Workspace {                          // an agency
  id            String   @id @default(cuid())
  name          String
  ownerId       String
  stripeConnectAccountId String? @unique   // Connect Standard acct
  connectOnboarded Boolean @default(false)
  memberships   Membership[]
  clientProjects ClientProject[]
  whiteLabel    WhiteLabelSettings?
  referralCode  String   @unique @default(cuid())
  directoryListed Boolean @default(false)  // platform_admin approves
  createdAt     DateTime @default(now())
}

model Membership {
  id           String @id @default(cuid())
  userId       String
  workspaceId  String
  role         WorkspaceRole
  user         User      @relation(fields: [userId], references: [id])
  workspace    Workspace @relation(fields: [workspaceId], references: [id])
  assignments  ClientAssignment[]          // which clients this member can access
  @@unique([userId, workspaceId])
}

model ClientProject {                      // one per agency customer
  id           String @id @default(cuid())
  workspaceId  String
  name         String
  workspace    Workspace @relation(fields: [workspaceId], references: [id])
  assignments  ClientAssignment[]
  portalUsers  ClientPortalUser[]
  integrations MarketplaceIntegration[]
  approvals    Approval[]
  workItems    WorkItem[]
  actions      AgentAction[]
  invoices     ClientInvoice[]
  archived     Boolean @default(false)     // drives Agency plan quantity billing
  createdAt    DateTime @default(now())
}

model ClientAssignment {
  id              String @id @default(cuid())
  membershipId    String
  clientProjectId String
  membership      Membership    @relation(fields: [membershipId], references: [id])
  clientProject   ClientProject @relation(fields: [clientProjectId], references: [id])
  @@unique([membershipId, clientProjectId])
}

model ClientPortalUser {                   // minimal login (magic link)
  id              String @id @default(cuid())
  clientProjectId String
  email           String
  name            String?
  clientProject   ClientProject @relation(fields: [clientProjectId], references: [id])
  magicTokens     MagicLinkToken[]
  @@unique([clientProjectId, email])
}

model MagicLinkToken {
  id            String @id @default(cuid())
  portalUserId  String
  tokenHash     String  @unique             // store HASH, never raw token
  expiresAt     DateTime
  usedAt        DateTime?
  portalUser    ClientPortalUser @relation(fields: [portalUserId], references: [id])
}

model Approval {                            // decisions sent to a human
  id              String @id @default(cuid())
  clientProjectId String?                   // null → self-serve customer approval
  userId          String?                   // owning customer if self-serve
  title           String
  detail          String
  payload         Json                      // structured action to execute on approve
  audience        String                    // 'CLIENT' | 'MANAGER' | 'CUSTOMER'
  status          ApprovalStatus @default(PENDING)
  decidedById     String?
  decidedAt       DateTime?
  clientProject   ClientProject? @relation(fields: [clientProjectId], references: [id])
  createdAt       DateTime @default(now())
}

model WorkItem {                            // staff/agent drafts → review → publish
  id              String @id @default(cuid())
  clientProjectId String
  title           String
  body            Json
  status          WorkStatus @default(DRAFT)
  createdByRole   ActionActor
  createdById     String?
  reviewedById    String?
  clientProject   ClientProject @relation(fields: [clientProjectId], references: [id])
  createdAt       DateTime @default(now())
}

model AgentAction {                         // immutable audit log
  id              String @id @default(cuid())
  clientProjectId String?
  userId          String?
  actor           ActionActor
  kind            String                    // e.g. 'ppc.bid_adjust', 'fees.claim_filed'
  summary         String                    // human-readable, client-visible if approved scope
  valueImpactCents Int?                     // e.g. +4100 = $41 recovered
  payload         Json
  clientProject   ClientProject? @relation(fields: [clientProjectId], references: [id])
  createdAt       DateTime @default(now())
}

model AgentUsage {                          // Starter metering (25/mo)
  id        String @id @default(cuid())
  userId    String
  month     String                          // '2026-07'
  count     Int    @default(0)
  user      User   @relation(fields: [userId], references: [id])
  @@unique([userId, month])
}

model WhiteLabelSettings {
  id            String @id @default(cuid())
  workspaceId   String @unique
  brandName     String
  accentColor   String  @default("#2DD4BF")
  logoUrl       String?
  customDomain  String? @unique             // portal.agency.com (CNAME)
  emailFrom     String?
  hideXenon     Boolean @default(true)
  workspace     Workspace @relation(fields: [workspaceId], references: [id])
}

model ClientInvoice {                       // mirrors invoice on agency's Connect acct
  id                 String @id @default(cuid())
  clientProjectId    String
  stripeInvoiceId    String @unique
  amountCents        Int
  currency           String @default("usd")
  status             InvoiceStatus
  hostedInvoiceUrl   String?
  recurring          Boolean @default(false)
  clientProject      ClientProject @relation(fields: [clientProjectId], references: [id])
  createdAt          DateTime @default(now())
}

model MarketplaceIntegration {
  id              String @id @default(cuid())
  clientProjectId String?                   // or userId for self-serve
  userId          String?
  provider        IntegrationProvider
  status          IntegrationStatus @default(DISCONNECTED)
  accessTokenEnc  String?                   // encrypted at rest
  refreshTokenEnc String?
  externalId      String?                   // seller id
  lastSyncAt      DateTime?
  clientProject   ClientProject? @relation(fields: [clientProjectId], references: [id])
}

model ReferralConversion {
  id            String @id @default(cuid())
  workspaceId   String                      // referring agency
  referredUserId String
  commissionPct Int     @default(25)
  monthlyCents  Int                         // current commission value
  active        Boolean @default(true)
  createdAt     DateTime @default(now())
}
```

## Invariants (test these)
1. A `ClientPortalUser` session can only ever read rows where `clientProjectId` matches its token's project.
2. `WorkItem` with status `DRAFT`/`IN_REVIEW` is never returned by any portal or customer-facing query.
3. Creating/archiving a `ClientProject` on an Agency plan updates the Stripe subscription quantity in the same transaction flow (with webhook reconciliation).
4. `MagicLinkToken` raw values are emailed once and only the hash is stored; tokens are single-use and expire ≤ 15 minutes.
5. `AgentAction` rows are append-only (no update/delete paths in app code).
6. All metric displays trace back to `AgentAction`, integration sync data, or Stripe — never constants.
