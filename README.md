# Delibero

**Delibero** is an AI-powered strategic debate platform where multiple expert personas deliberate your toughest business questions. It uses adversarial reasoning to challenge assumptions, stress-test ideas, and synthesize a more robust path forward.

![Delibero UI](https://github.com/mohitmujawdiya/delibero/raw/main/public/delibero-preview.png)

## 🚀 Features

- **Strategic Reframing**: Before the debate begins, a specialized agent analyzes your question to identify hidden asymmetries and reframe the problem statement.
- **Multi-Persona Debate**: Four distinct AI agents (CEO, CFO, CTO, Product) debate the reframed question, each with their own incentives and cognitive biases.
- **Adversarial Reasoning**: Agents don't just agree; they are prompted to challenge each other, expose risks, and fight for resources.
- **Constraint Critic**: A "reality check" phase that evaluates the emerging consensus against your specific real-world constraints (budget, timeline, team size).
- **Strategic Synthesis**: The final output isn't just a summary—it provides a clear **Strategic Thesis**, a decision matrix, and **Lessons from the Losing Side**.

## 🧠 The Personas

1.  **Elena Vasquez (Chief Strategy Officer)**: Visionary, focuses on long-term moats and market positioning.
2.  **Morgan Blackwell (CFO)**: Conservative, focuses on capital preservation, unit economics, and option value.
3.  **Dr. Marcus Chen (Devil's Advocate)**: Contrarian, specifically targets cognitive biases (sunk cost, action bias) and organizational incentives.
4.  **Sarah Jenkins (VP Strategy)**: Pragmatic, focuses on execution feasibility and customer impact.

## 🛠️ Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Styling**: Vanilla CSS (CSS Variables, Flexbox/Grid) — no Tailwind
- **AI**: OpenAI (GPT-4o) or Anthropic (Claude 3.5 Sonnet)
- **Streaming**: Server-Sent Events (SSE) for real-time debate playback



## 🏗️ Technical Architecture

### 1. Hybrid Orchestration (Client-Driven)
Delibero uses a unique **"Thick Client, Smart Edge"** architecture to handle complex, long-running debates without timeouts.
- **Orchestrator**: The debate loop (`engine.ts`) runs partially on the client to manage state and partially on the Edge to generate tokens.
- **Streaming**: All agent responses are streamed in real-time using `ReadableStream`, ensuring the application remains responsive even during 60+ second generations.
- **Persistence**: Debate history is stored entirely in the user's browser (`localStorage`), prioritizing privacy and removing the need for a database.

### 2. The Reasoning Topology
The core engine follows a strict, multi-stage topology for every round:
1.  **Generation**: Agents generate arguments in parallel based on their persona constraints.
2.  **Evidence Audit**: A separate model extracts claims and checks for hallucinations or contradictions.
3.  **Cross-Examination**: If contradictions are found, a "Cross-Exam" phase is triggered where agents interrogate each other.
4.  **Constraint Critic**: An iterative loop checks the emerging consensus against hard constraints (Budget, Legal, Timeline) *before* the next round starts.
5.  **Synthesis**: A final step compresses the round's context and decides if the debate needs to diverge (extend) or converge (end).

### 3. Edge-First API
- **Runtime**: `/api/chat` runs on **Vercel Edge Runtime** to bypass the standard 10s serverless timeout, allowing for deep-thinking models to run to completion.
- **Security**: Stateless API design protected by a `DELIBERO_ACCESS_CODE` to prevent unauthorized usage.

All Rights Reserved. Closed Source.
