# 📑 Active Payment Notification Regex & Pattern Specification

Authoritative reference map of active notification title, body, and text patterns supported by **StreamPe** for **PhonePe**, **Google Pay**, and **Amazon Pay**, including exact raw notification payload examples, matching regex patterns, and classification (**Payment Alert** vs **Non-Payment Alert**).

---

## 📱 1. PhonePe (`com.phonepe.app`)

| # | Notification Format Pattern | Example Raw Notification Payload | Matching Regex Pattern | Classification | Variable Extraction & Notes |
|---|---|---|---|---|---|
| 1 | **Title**: `PhonePe - <Sender>`<br>**Text**: `has sent ₹<Amount>` | **Title**: `PhonePe - Rahul Sharma`<br>**Text**: `has sent ₹500.00` | **Title**: `/^PhonePe\s*[-:]\s*(.+)/i`<br>**Body**: `/has\s+sent\s+(?:\u20B9\|rs\.?\s*)([\d,.]+)/i` | 🟢 **Payment Alert** | **Sender**: Title group 1 (`Rahul Sharma`)<br>**Amount**: Body group 1 (`500.00`) |
| 2 | **Title**: `PhonePe: <Sender>`<br>**Text**: `₹<Amount> received` | **Title**: `PhonePe: Vikramaditya`<br>**Text**: `₹1,000 received` | **Title**: `/^PhonePe\s*[-:]\s*(.+)/i`<br>**Body**: `/(?:\u20B9\|rs\.?\s*)([\d,.]+)\s+received/i` | 🟢 **Payment Alert** | **Sender**: Title group 1 (`Vikramaditya`)<br>**Amount**: Body group 1 (`1,000.00`) |
| 3 | **Text**: `<Sender> has sent ₹<Amount>` | **Title**: `PhonePe`<br>**Text**: `Rahul Sharma has sent ₹500` | `/^(.+?)\s+has\s+sent\s+(?:\u20B9\|rs\.?\s*)([\d,.]+)/i` | 🟢 **Payment Alert** | Standard PhonePe personal payment.<br>**Sender**: Group 1, **Amount**: Group 2 |
| 4 | **Text**: `₹<Amount> received from <Sender>` | **Title**: `PhonePe`<br>**Text**: `₹250 received from Amit Kumar` | `/(?:\u20B9\|rs\.?\s*)([\d,.]+)\s+received\s+from\s+(.+)/i` | 🟢 **Payment Alert** | PhonePe Merchant / QR code payment.<br>**Sender**: Group 2, **Amount**: Group 1 |
| 5 | **Text**: `Payment of ₹<Amount> received from <Sender>` | **Title**: `PhonePe Business`<br>**Text**: `Payment of ₹2,500 received from Suresh` | `/payment\s+of\s+(?:\u20B9\|rs\.?\s*)([\d,.]+)\s+received\s+from\s+(.+)/i` | 🟢 **Payment Alert** | PhonePe Business / Smart Soundbox alert.<br>**Sender**: Group 2, **Amount**: Group 1 |
| 6 | **Text**: `<Sender> sent ₹<Amount>` | **Title**: `PhonePe`<br>**Text**: `Priya Patel sent ₹100` | `/^(.+?)\s+sent\s+(?:\u20B9\|rs\.?\s*)([\d,.]+)/i` | 🟢 **Payment Alert** | Direct UPI transfer format.<br>**Sender**: Group 1, **Amount**: Group 2 |
| 7 | **Text**: `₹<Amount> credited to your bank account from <Sender>` | **Title**: `PhonePe`<br>**Text**: `₹1,500.00 credited to your bank account XX5678 from Amit` | `/(?:\u20B9\|rs\.?\s*)([\d,.]+)\s+credited\s+to\s+your\s+bank\s+account.*from\s+(.+)/i` | 🟢 **Payment Alert** | Direct bank credit notification.<br>**Sender**: Group 2, **Amount**: Group 1 |
| 8 | **Text**: `<Sender> requested ₹<Amount> from you` | **Title**: `PhonePe`<br>**Text**: `Rahul requested ₹500 from you on PhonePe` | `/(?:requested.*from you\|collect request\|request pending)/i` | 🔴 **Non-Payment Alert** | Outgoing Collect Request (Money requested from streamer). Ignored. |
| 9 | **Text**: `You have paid ₹<Amount> to <Merchant>` | **Title**: `PhonePe`<br>**Text**: `You have paid ₹350 to Swiggy` | `/you\s+(?:have\s+)?paid\s+(?:\u20B9\|rs\.?\s*)([\d,.]+)\s+to\s+(.+)/i` | 🔴 **Non-Payment Alert** | Outgoing payment made by streamer (Debit). Ignored. |
| 10 | **Text**: `OTP received: 123456 for PhonePe login` | **Title**: `PhonePe`<br>**Text**: `Use 123456 as your PhonePe OTP` | `/(?:otp\|verification code\|one time password)/i` | 🔴 **Non-Payment Alert** | Security / OTP notification. Ignored. |
| 11 | **Text**: `Congratulations! You won a scratch card reward` | **Title**: `PhonePe Rewards`<br>**Text**: `You won a cashback scratch card` | `/(?:cashback won\|scratch card\|reward earned)/i` | 🔴 **Non-Payment Alert** | Marketing / Reward alert. Ignored. |
| 12 | **Text**: `Bank balance update: A/C ending 1234 balance ₹...` | **Title**: `PhonePe`<br>**Text**: `Available balance in A/C XX1234 is ₹12,500` | `/(?:bank balance\|available balance)/i` | 🔴 **Non-Payment Alert** | Informational bank balance SMS/Push. Ignored. |

---

## 🌐 2. Google Pay (`com.google.android.apps.nbu.paisa.user`)

| # | Notification Format Pattern | Example Raw Notification Payload | Matching Regex Pattern | Classification | Variable Extraction & Notes |
|---|---|---|---|---|---|
| 1 | **Text**: `<Sender> paid you ₹<Amount>` | **Title**: `Google Pay`<br>**Text**: `Rahul Sharma paid you ₹500` | `/^(.+?)\s+paid\s+you\s+(?:\u20B9\|rs\.?\s*)([\d,.]+)/i` | 🟢 **Payment Alert** | Standard GPay personal payment.<br>**Sender**: Group 1, **Amount**: Group 2 |
| 2 | **Text**: `<Sender> paid you <Amount> rupees` | **Title**: `Google Pay`<br>**Text**: `Amit Verma paid you 250 rupees` | `/^(.+?)\s+paid\s+you\s+([\d,.]+)\s+rupees/i` | 🟢 **Payment Alert** | GPay text format without currency symbol.<br>**Sender**: Group 1, **Amount**: Group 2 |
| 3 | **Text**: `You received ₹<Amount> from <Sender>` | **Title**: `Google Pay`<br>**Text**: `You received ₹1,200 from Sneha Gupta` | `/you\s+received\s+(?:\u20B9\|rs\.?\s*)([\d,.]+)\s+from\s+(.+)/i` | 🟢 **Payment Alert** | GPay incoming transfer notification.<br>**Sender**: Group 2, **Amount**: Group 1 |
| 4 | **Text**: `₹<Amount> received from <Sender>` | **Title**: `Google Pay Business`<br>**Text**: `₹500 received from Vikram` | `/(?:\u20B9\|rs\.?\s*)([\d,.]+)\s+received\s+from\s+(.+)/i` | 🟢 **Payment Alert** | GPay Business / Merchant QR code payment.<br>**Sender**: Group 2, **Amount**: Group 1 |
| 5 | **Text**: `<Sender> is requesting ₹<Amount>` | **Title**: `Google Pay`<br>**Text**: `Rohan is requesting ₹200 from you` | `/(?:is requesting\|requesting ₹\|collect request)/i` | 🔴 **Non-Payment Alert** | Outgoing Payment Request (Money requested from streamer). Ignored. |
| 6 | **Text**: `You paid ₹<Amount> to <Merchant>` | **Title**: `Google Pay`<br>**Text**: `You paid ₹450 to Zomato` | `/you\s+paid\s+(?:\u20B9\|rs\.?\s*)([\d,.]+)\s+to\s+(.+)/i` | 🔴 **Non-Payment Alert** | Outgoing payment made by streamer (Debit). Ignored. |
| 7 | **Text**: `Scratch card unlocked! Claim your reward` | **Title**: `Google Pay Rewards`<br>**Text**: `You earned a scratch card reward` | `/(?:scratch card\|reward earned\|cashback)/i` | 🔴 **Non-Payment Alert** | Promotional reward alert. Ignored. |

---

## 📦 3. Amazon Pay (`com.amazon.mShop.android.shopping`)

| # | Notification Format Pattern | Example Raw Notification Payload | Matching Regex Pattern | Classification | Variable Extraction & Notes |
|---|---|---|---|---|---|
| 1 | **Title**: `₹<Amount> received`<br>**Text**: `Money received from <Sender> on Amazon Pay` | **Title**: `₹500 received`<br>**Text**: `Money received from Rahul Sharma on Amazon Pay` | **Title**: `/(?:\u20B9\|rs\.?\s*)([\d,.]+)\s+received/i`<br>**Body**: `/money\s+rec(?:ei)?ved\s+from\s+(.+?)\s+on\s+amazon\s+pay/i` | 🟢 **Payment Alert** | **Sender**: Body group 1 (`Rahul Sharma`)<br>**Amount**: Title group 1 (`500.00`) |
| 2 | **Text**: `₹<Amount> received from <Sender>` | **Title**: `Amazon Pay`<br>**Text**: `₹1,000 received from Vikas Singh` | `/(?:\u20B9\|rs\.?\s*)([\d,.]+)\s+received\s+from\s+(.+)/i` | 🟢 **Payment Alert** | Amazon Pay UPI incoming transfer.<br>**Sender**: Group 2, **Amount**: Group 1 |
| 3 | **Text**: `You received ₹<Amount> from <Sender> on Amazon Pay` | **Title**: `Amazon Pay`<br>**Text**: `You received ₹300 from Ananya on Amazon Pay` | `/you\s+received\s+(?:\u20B9\|rs\.?\s*)([\d,.]+)\s+from\s+(.+)/i` | 🟢 **Payment Alert** | Amazon Pay transfer alert.<br>**Sender**: Group 2, **Amount**: Group 1 |
| 4 | **Text**: `<Sender> requested ₹<Amount> via Amazon Pay` | **Title**: `Amazon Pay`<br>**Text**: `Karan requested ₹500 via Amazon Pay` | `/(?:requested.*via amazon pay\|payment request)/i` | 🔴 **Non-Payment Alert** | Outgoing Payment Request (Money requested from streamer). Ignored. |
| 5 | **Text**: `Your order has been shipped` | **Title**: `Amazon Shopping`<br>**Text**: `Your order #123-4567890-1234567 has shipped` | `/(?:order.*shipped\|out for delivery\|delivered)/i` | 🔴 **Non-Payment Alert** | Amazon e-commerce package delivery update. Ignored. |
| 6 | **Text**: `Cashback of ₹50 credited to Amazon Pay Balance` | **Title**: `Amazon Pay`<br>**Text**: `Cashback of ₹50 added to balance` | `/(?:cashback.*credited\|balance added\|gift card added)/i` | 🔴 **Non-Payment Alert** | Internal cashback reward / gift card update. Ignored. |

---

## 🎯 Verification Matrix & Control Flow

To prevent false positives, incoming notifications undergo a two-phase check in [`server.js`](file:///d:/xwork/projects/payment-alerts-for-obs/pc-server/server.js#L400-L408):

1. **Negative Filter Check (`RE_NON_PAYMENT`)**:
   - If notification content matches promotional, OTP, cashback, delivery, money requests (`requested|requesting|collect`), or debit keywords (`RE_NON_PAYMENT`), it is **rejected** immediately UNLESS an explicit positive payment match (`RE_PHONEPE_AMOUNT`, `RE_GPAY_PAID_YOU_SYMBOL`, or `RE_AMAZON_SENDER`) is satisfied.
2. **Positive Parser Matching**:
   - If it passes the filter, the parser extracts **Sender Name**, **Amount**, and **Source App** (`PhonePe`, `Google Pay`, `Amazon Pay`), and strips any trailing/leading app name prefixes (`"PhonePe - "`, `"PhonePe: "`, `"GPay - "`).
