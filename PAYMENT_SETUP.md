# Unlock setup and current limits

The saved review now has Continue, which opens the unlock screen. Closing it preserves the run. A valid invite code saves a comped unlock on the same run; reopening it shows that saved unlock rather than asking for payment again.

Full research and final website planning are not connected yet. The unlocked screen states that clearly. No processing is claimed or simulated. Checkout currently rejects live Razorpay credentials, so this version cannot charge real money.

## Invite code

The single code is configured as `TOPIC_GIBBON_INVITE_CODE` on both Convex deployments. Its private local copy is `artifacts/invite-code.txt`, which is ignored by Git. It is never included in browser code or public query results. The code is case-sensitive; surrounding spaces are ignored. Five failed attempts per run per minute are allowed.

To replace it, enter the new code privately at each terminal prompt:

```powershell
npx convex env set TOPIC_GIBBON_INVITE_CODE
npx convex env set TOPIC_GIBBON_INVITE_CODE --prod
```

Update the ignored local copy if using the live verification script after changing the code.

## Razorpay account setup still required

The user does not have a Razorpay account yet. After creating one, use **Test Mode** and set these values privately on Convex (never in chat, source code, or a `VITE_` variable):

```powershell
npx convex env set RAZORPAY_KEY_ID --prod
npx convex env set RAZORPAY_KEY_SECRET --prod
npx convex env set RAZORPAY_WEBHOOK_SECRET --prod
```

For development testing, repeat without `--prod`. The key ID must begin with `rzp_test_`. Although Razorpay requires the public key ID in Checkout, the secret key and webhook secret stay on the server. Configure automatic payment capture in Razorpay.

Configure a Test Mode webhook at `https://ardent-fly-778.convex.site/api/razorpay/webhook`, subscribing to `payment.captured` and `order.paid`. Set the same privately chosen webhook secret in Razorpay and Convex. Signatures are checked against the raw body. The return-from-checkout signature is checked against the order stored on the server, and payment status is fetched from Razorpay. Only a captured ₹399 INR UPI payment for that order can unlock. A return from a UPI app or an authorized-but-not-captured payment is not success. Reopening the screen checks the existing order rather than creating another one.

Checkout is configured for UPI only. Razorpay owns its phone app handoff and desktop QR UI. Its test screen may simulate payments; real-device UPI/QR checks and live activation must wait until the promised full research works. Do not turn on live charging merely to test this unfinished product.

## Verification

`npm test` covers amount/currency/method/status checks, invalid signatures, webhook duplicates, per-run authorization, invitation guessing limits, unconfirmed reviews, duplicate order reservation, and preservation of the confirmed run.

`npx tsx scripts/verify-unlock.ts` creates a separate run from saved real evidence and verifies the configured production invite code without printing it. It checks rejection before review, a wrong code, successful comped unlock, a fresh read, unchanged evidence, no additional searches, and absence of the code in the deployed client script. Receipts stay in ignored `artifacts/`.

Browser clicks and actual Razorpay checkout still need verification. Unit tests are not evidence of a working UPI app handoff.

References: [Razorpay integration steps](https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/integration-steps/), [UPI-only Checkout configuration](https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/configure-payment-methods/sample-code/), [webhook validation](https://razorpay.com/docs/webhooks/validate-test/).
