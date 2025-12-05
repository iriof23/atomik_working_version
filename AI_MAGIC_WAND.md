# AI Magic Wand: Capabilities & Credit System

The "Magic Wand" is Atomik's integrated AI assistant, designed to accelerate the reporting process for penetration testers. It leverages advanced LLMs to generate, enhance, and format content directly within the application.

## Features & Capabilities

The AI capabilities are divided into four tiers, each with specific features and credit costs.

### Phase 1: Core Text Enhancement (The "Editor Helper")
**Goal:** Quick fixes and improvements for individual text fields.
**Cost:** 1 Credit per use

- **Rewrite Professionally:** Adjusts the tone of the selected text to be more formal, objective, and suitable for a professional audit report.
- **Fix Grammar & Spelling:** Corrects grammatical errors and typos without changing the meaning.
- **Expand Note:** Converts shorthand bullet points or rough notes into full, well-structured paragraphs.

### Phase 2: Context-Aware Generation (The "Content Creator")
**Goal:** Generate substantial new content from minimal inputs.
**Cost:** 3-5 Credits per use

- **Executive Summary Generator:** Analyzes the project's finding statistics (critical counts, categories) and generates a C-level executive summary.
- **PoC Formatter:** Takes a raw HTTP request/response dump and formats it into a clean, step-by-step "Proof of Concept" reproduction guide.
- **Remediation Suggester:** Suggests specific code fixes or configuration changes based on the vulnerability title and technology stack.

### Phase 3: Knowledge & Compliance (The "Expert Consultant")
**Goal:** Map findings to external standards and enrich data with expert knowledge.
**Cost:** 5-10 Credits per use

- **Compliance Mapper:** Analyzes a finding description and suggests relevant mappings to standards like PCI-DSS (e.g., "Requirement 6.5.1"), HIPAA, or GDPR.
- **CVE/CWE Lookup:** Suggests the most accurate CWE ID or related CVEs for a finding.
- **Business Impact Analysis:** Generates a tailored "Impact" section by combining the technical vulnerability with the specific business context of the asset.

### Phase 4: "Magic Fill" (The "Time Saver")
**Goal:** One-click population of entire complex forms.
**Cost:** 15-20 Credits per use

- **Finding Auto-Complete:** Enter just a title (e.g., "SQL Injection") and the AI populates the Description, Impact, Remediation, and References fields with high-quality template data.
- **Methodology Builder:** Select a testing type (e.g., "Black Box Web App") and the AI writes a comprehensive Methodology section covering tools, phases, and coverage.

---

## Credit System

Credits are purchased via the Billing settings and are deducted immediately upon successful generation of content.

| Tier | Feature Set | Cost (Credits) |
|------|------------|----------------|
| **Tier 1** | Text Polish (Rewrite, Fix Grammar) | 1 |
| **Tier 2** | Content Generation (Summaries, PoC) | 3-5 |
| **Tier 3** | Expert Knowledge (Compliance, Impact) | 5-10 |
| **Tier 4** | Magic Fill (Full Form Completion) | 15-20 |

*Note: If an AI request fails, credits are not deducted.*

