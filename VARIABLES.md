# 🎛️ StreamPe Overlay Template Variables Guide

StreamPe includes a **Fullscreen Code Studio** allowing streamers to completely customize the HTML, CSS, and JavaScript of all stream overlays with a live interactive preview sandbox.

StreamPe overlays use [Handlebars](https://handlebarsjs.com/) templating with built-in helper functions and XSS-safe escaping.

---

## 📌 Syntax & Usage

| Syntax | Description | Example |
| :--- | :--- | :--- |
| `{{varName}}` | **HTML-Escaped Output** (XSS Safe) | `<span>{{sender}}</span>` $\rightarrow$ `<span>Rahul</span>` |
| `{{{mediaHtml}}}` | **Raw HTML Output** (for pre-rendered media/icons) | `{{{mediaHtml}}}` $\rightarrow$ `<img class="alert-media" src="..." />` |
| `{{#if (gte amount 500)}}` | **Conditional Logic** with comparison helpers | Renders block only if amount $\ge$ 500 |
| `{{default message "Thanks!"}}` | **Fallback Values** if variable is empty | Uses fallback string if message is blank |

---

## 💡 `amount` vs `formattedAmount`

| Variable | Type | Example Value | Description & Best Use Case |
| :--- | :--- | :--- | :--- |
| `amount` | Number | `500` or `1250.5` | Raw numerical value without currency symbols or commas. Ideal for mathematical calculations, custom JavaScript logic, or Handlebars comparisons (`{{#if (gte amount 1000)}}`). |
| `formattedAmount` | String | `₹500.00` or `₹1,250` | Locale-formatted string with currency symbol and thousands separators. Ideal for direct visual display in HTML templates. |

---

## 🔔 1. Payment Alerts (`alerts`)

Template variables available for individual donation & payment alert templates:

| Variable | Type | Example Value | Description |
| :--- | :--- | :--- | :--- |
| `{{title}}` | String | `Rahul Kumar` | Rendered alert title header |
| `{{subtitle}}` | String | `sent ₹500` | Rendered alert subtitle |
| `{{amount}}` | Number | `500` | Raw numeric donation amount |
| `{{formattedAmount}}` | String | `₹500.00` | Formatted donation amount with currency |
| `{{sender}}` | String | `Rahul Kumar` | Donor display name or custom alias |
| `{{rawSender}}` | String | `RAHUL KUMAR` | Original bank/UPI sender name |
| `{{message}}` | String | `Keep up the great stream! 🔥` | Donor payment note or message |
| `{{currency}}` | String | `INR` | Currency code |
| `{{providerName}}` | String | `PhonePe` | Payment application name (e.g. PhonePe, Google Pay, Paytm) |
| `{{providerKey}}` | String | `phonepe` | Normalized provider identifier key |
| `{{sourceApp}}` | String | `PhonePe` | Source application name (alias for `providerName`) |
| `{{mediaHtml}}` | HTML String | `<img class="alert-media" ... />` | Pre-rendered media element (image, GIF, or video) |
| `{{time}}` | String | `10:45 AM` | Formatted event timestamp |
| `{{date}}` | String | `Sep 13, 2026` | Formatted event date |

---

## 🎯 2. Goal Widget (`goal`)

Template variables available for donation & payment goal overlays:

| Variable | Type | Example Value | Description |
| :--- | :--- | :--- | :--- |
| `{{title}}` | String | `New Stream Mic` | Goal header title |
| `{{subtitle}}` | String | `Help us reach our target!` | Goal subtitle |
| `{{current}}` | Number | `1200` | Numeric current accumulated amount |
| `{{target}}` | Number | `5000` | Numeric goal target amount |
| `{{currentAmount}}` | String | `₹1,200` | Formatted current accumulated amount |
| `{{targetAmount}}` | String | `₹5,000` | Formatted target goal amount |
| `{{formattedCurrent}}` | String | `₹1,200.00` | Formatted current amount alias |
| `{{formattedTarget}}` | String | `₹5,000.00` | Formatted target amount alias |
| `{{percent}}` | String | `24.0%` | Formatted progress percentage with `%` |
| `{{percentage}}` | Number | `24.0` | Numeric progress percentage (0–100+) |
| `{{endDate}}` | String | `2026-10-01` | Optional goal deadline or end date |

---

## 🏆 3. List Widgets (`list`: Leaderboard & Recent Donations)

Template variables available for Top Supporters Leaderboards and Recent Donations lists:

| Variable | Type | Example Value | Description |
| :--- | :--- | :--- | :--- |
| `{{title}}` | String | `Top Supporters` / `Recent Donations` | List widget header title |
| `{{count}}` | Number | `5` | Number of rows currently rendered |
| `{{max}}` | Number | `5` | Maximum configured rows to display |
| `{{maxEntries}}` | Number | `5` | Alias for `max` |
| `{{totalAmount}}` | Number | `2500` | Numeric sum of listed donations |
| `{{formattedTotal}}` | String | `₹2,500` | Formatted sum of listed donations with currency |
| `{{items}}` | Element | *(HTML Container)* | Rows container placeholder element (`.lb-list`) |

---

## 🔄 4. Cycling Info Widget (`cycling`)

Template variables available for the rotational cycling widget:

| Variable | Type | Example Value | Description |
| :--- | :--- | :--- | :--- |
| `{{label}}` | String | `Top Supporter` / `Recent Donation` | Step label or custom item header |
| `{{text}}` | String | `Rahul ₹500` | Combined display content text |
| `{{name}}` | String | `Rahul` | Donor name (for dynamic top/recent donor steps) |
| `{{amount}}` | Number | `500` | Numeric donation amount |
| `{{formattedAmount}}` | String | `₹500` | Formatted donation amount with currency |
| `{{transitionIn}}` | String | `slide-up` | Active enter animation name |
| `{{transitionEffect}}` | String | `slide-up` | Alias for `transitionIn` |
| `{{mediaHtml}}` | HTML String | `<i data-lucide="trophy"></i>` | Rendered Lucide vector icon or custom image element |

---

## 🛠️ Built-in Handlebars Helper Reference

StreamPe provides custom comparison and utility helpers for advanced conditional rendering:

| Helper | Syntax | Example | Description |
| :--- | :--- | :--- | :--- |
| `gte` | `(gte a b)` | `{{#if (gte amount 500)}}🌟 VIP{{/if}}` | Greater than or equal to ($\ge$) |
| `lte` | `(lte a b)` | `{{#if (lte amount 100)}}Small{{/if}}` | Less than or equal to ($\le$) |
| `gt` | `(gt a b)` | `{{#if (gt amount 0)}}...{{/if}}` | Strictly greater than ($>$) |
| `lt` | `(lt a b)` | `{{#if (lt amount 1000)}}...{{/if}}` | Strictly less than ($<$) |
| `eq` | `(eq a b)` | `{{#if (eq providerKey 'phonepe')}}💜{{/if}}` | Equality check ($==$) |
| `ne` | `(ne a b)` | `{{#if (ne sender 'Anonymous')}}...{{/if}}` | Inequality check ($\ne$) |
| `formatAmount` | `(formatAmount num)` | `{{formatAmount amount}}` | Formats a raw number to currency string |
| `default` | `(default val fallback)` | `{{default message "No message"}}` | Fallback if value is empty |
