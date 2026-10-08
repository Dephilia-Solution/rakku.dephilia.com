export const ownerUrl = process.env.NEXT_PUBLIC_OWNER_URL ||
  (process.env.NODE_ENV === "production" ? "https://rakku.vercel.app" : "http://localhost:3000");
export const posUrl = process.env.NEXT_PUBLIC_POS_URL ||
  (process.env.NODE_ENV === "production" ? "https://pos-rakku.vercel.app" : "http://localhost:3001");
