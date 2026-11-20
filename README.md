# FACET Web (`@facet/web`)

[![FACET](https://img.shields.io/badge/FACET-facet.briandev.space-050505?style=flat-square&labelColor=DFFF4F)](https://facet.briandev.space)
[![Layer](https://img.shields.io/badge/INTERFACE-WEB%20CONSOLE-0D0D0D?style=flat-square&labelColor=343434)](https://github.com/facet-aex)

> Official Next.js web application for the FACET Store, Provider Studios, Playground, Faucet, and documentation.

## Overview

`web` is the human-facing web interface for **FACET** (`https://facet.briandev.space`). It connects capability creators, operators, and AI agent builders with the public Facet Store, capability authoring studios, an interactive execution playground, and on-chain verification views.

## Role in FACET

- **Facet Store & Explorer:** Lets users search and inspect published `API`, `ACTOR`, and `AGENT` capabilities, view pricing options, inspect structured datasets, and trace on-chain payment and receipt transactions.
- **Provider Studios:** Provides dedicated workflows for publishing OpenAPI or full-HTTP `API` Facets, single-file ESM `ACTOR` modules, and `ERC-8004` `AGENT` profiles with verified payout wallets.
- **Wallet-Signed Playground & Faucet:** Supports interactive browser-wallet EIP-3009 signing over x402 via `gateway` and dispenses test `fUSD` through `/faucet`.
- **Documentation & Quick Start:** Hosts the platform documentation (`/docs`) and agent onboarding quick start for `@facet-aex/cli` and `@facet-aex/mcp-server`.

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router), React 19, TypeScript |
| Auth & Identity | Clerk (`@clerk/nextjs`, `@clerk/backend`) |
| Web3 & Payments | `viem`, `@x402/core`, `@x402/evm` |
| Typography & Styling | Self-hosted `Inter Tight` & `IBM Plex Mono`, CSS |
| Testing & Container | Vitest, ESLint, Docker (`node:24-alpine`) |

---

Part of **[FACET](https://facet.briandev.space)** (`facet-aex`) — Federated Agent Capability Exchange & Trust on Avalanche.
