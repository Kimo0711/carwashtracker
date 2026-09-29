This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Employee Time Clock (AutoSpa L'Exception)

- Employee clock screen: `/time-clock`
- Manager dashboard: `/time-clock/manager`

### WiFi ping setup (required for punch validation)

The manager must host a plain text file named `ping.txt` containing only:

```txt
ok
```

Then enter that local URL (for example `http://192.168.1.1/ping.txt`) in the manager setup screen.

Common local hosting options:

1. **Router USB file share**  
   Example URL: `http://192.168.0.1/ping.txt` (depends on router model and file-sharing settings).
2. **Raspberry Pi with simple web server**  
   Example URL: `http://192.168.1.50/ping.txt`.
3. **NAS local web folder (Synology/QNAP/etc.)**  
   Example URL: `http://192.168.1.20/ping.txt`.

If the app cannot fetch this file within 3 seconds, punches are rejected with:
`You must be connected to the shop WiFi`.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
