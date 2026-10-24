# Mithai Shop – Netlify deployment

Structure
- public/index.html  – home page
- public/order.html  – customer order page (places orders, shows reference, UPI pay)
- public/owner.html  – shop owner login + orders dashboard
- netlify/functions/api.mjs – backend (saves orders in Netlify Blobs, owner login)
- netlify.toml, package.json

## Deploy
1. Deploy with Git or the CLI (the backend function needs a build, so plain drag-and-drop is not enough): push this folder to a GitHub repo and import it in Netlify, or run `npm i -g netlify-cli && netlify deploy --prod`.
2. In Netlify: Site configuration > Environment variables, add:
   - OWNER_USER  – your login username
   - OWNER_PASS  – a strong password
   - TOKEN_SECRET – a long random string (e.g. 40+ characters)
3. Redeploy after setting the variables.
4. Open /owner.html and log in.

## Shop settings (public/order.html, near the top of the script)
- WA  – WhatsApp number with country code, digits only, e.g. "919876543210"
- UPI – your UPI ID, e.g. "mithaishop@upi"

## Still to edit
- public/index.html footer: shop address and phone number.

## Local test
npm install && netlify dev
