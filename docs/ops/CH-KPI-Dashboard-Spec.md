# Collective Hive KPI Dashboard Spec

## Purpose
Single source of truth for operating performance, financial health, and lender-facing reporting.

## Dashboard Tabs
1. Executive Summary
2. Growth & Retention
3. Unit Economics
4. Service Delivery
5. Cash & Runway
6. Risk Watchlist

## Executive Summary (Top Row Cards)
- Active Members
- Net New Members (month)
- MRR
- Gross Margin %
- EBITDA (proxy)
- Ending Cash
- Cash Runway (months)
- Churn %

## Growth & Retention
### Metrics
- New members
- Churned members
- Net adds
- Active members by plan
- Monthly logo churn
- Cohort retention (3/6/12 month)

### Visuals
- Active members line chart
- Net adds bar chart
- Cohort retention heatmap

## Unit Economics
### Metrics
- ARPM
- COGS per member
- Gross profit per member
- CAC
- CAC payback
- LTV proxy

### Visuals
- ARPM trend
- CAC vs payback trend
- Margin waterfall

## Service Delivery
### Metrics
- Tickets opened/resolved
- First response time
- Resolution time
- SLA breach count
- Escalation rate
- AI deflection rate

### Visuals
- Ticket volume trend
- SLA breach trend
- Deflection gauge

## Cash & Runway
### Metrics
- Ending cash
- Monthly net cash change
- Burn multiple (if applicable)
- Runway months

### Visuals
- Cash balance line
- Net cash bar (monthly)

## Risk Watchlist
### Red/Yellow/Green thresholds
- Churn > 4% (red)
- Gross margin < 47% (red)
- CAC payback > 6 months (red)
- Runway < 6 months (red)
- SLA breaches persistent 3+ weeks (red)

## Refresh Cadence
- Weekly: service and support metrics
- Monthly: financial and retention pack
- Quarterly: strategy and pricing review
