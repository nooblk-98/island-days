<div align="center">
  <img src="public/favicon.svg" width="72" height="72" alt="Island Days sun logo">

  <h1>Island Days</h1>
  <p><strong>A little more time for life.</strong></p>
  <p>A thoughtfully designed public holiday calendar for Sri Lanka.<br>Find your next pause, explore Poya days, and make room for a longer break.</p>

  <p><a href="https://island-days.pages.dev/"><strong>Explore the live calendar ↗</strong></a></p>

  [![Calendar checks](https://github.com/nooblk-98/island-days/actions/workflows/update-and-deploy.yml/badge.svg)](https://github.com/nooblk-98/island-days/actions/workflows/update-and-deploy.yml)
  ![JavaScript](https://img.shields.io/badge/JavaScript-ES_modules-f2cc60?logo=javascript&logoColor=253c30)
  ![Cloudflare Pages](https://img.shields.io/badge/Cloudflare-Pages-f38020?logo=cloudflarepages&logoColor=white)
  ![Monthly updates](https://img.shields.io/badge/Holiday_refresh-Monthly-417e38)
</div>

![Island Days calendar with upcoming Sri Lanka holidays and a year summary](docs/preview.jpg)

## Overview

Island Days brings Sri Lanka’s public holidays into a calm, easy-to-explore calendar. A warm green-and-cream palette, clear date highlights, and responsive layouts make it useful whether you are planning the year ahead or looking for your next day off.

The project is maintained by [nooblk-98](https://github.com/nooblk-98), with holiday dates sourced from [PublicHolidays.lk](https://publicholidays.lk/).

## Features

- **Month, year, and list views** — browse one month, see the year at a glance, or search the full holiday list.
- **Poya day highlights** — distinct colours and filters for Poya days and other public holidays.
- **Upcoming holidays** — a next-holiday countdown and a short list of dates to look forward to.
- **Long weekend discovery** — breaks of three days or more, combining public holidays with Saturday–Sunday weekends without extra leave.
- **Calendar downloads** — export a single holiday or a full year as an `.ics` file for your preferred calendar app.
- **Transparent data status** — last-checked dates, source links, estimate labels, and overdue-update notices.
- **Responsive and accessible** — phone-friendly layouts, keyboard focus, accessible dialogs, reduced-motion support, and print styling.

## Maintained, with care

Every push to `main` builds, checks, and deploys the calendar to Cloudflare Pages. A monthly GitHub Actions run refreshes and validates the source data before publishing; the same refresh can be run manually. Failed refreshes leave the current live calendar available, and past years remain available as the source rolls forward.

Dates use **Asia/Colombo**, independently of the visitor’s browser timezone. Poya days are public holidays and are highlighted separately. Year totals count distinct dates, including days with more than one holiday.

## Built with

**HTML · CSS · Vanilla JavaScript · Node.js · Cheerio · GitHub Actions · Cloudflare Pages**

A static website with no frontend framework, database, visitor accounts, analytics, or external fonts.

> [!NOTE]
> Holiday dates may change. Years marked as estimates preserve the source’s status. Verify dates and working arrangements before booking. Calendar downloads are one-time imports, not live subscriptions.
