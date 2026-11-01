import { redirect } from "next/navigation";
import { getTenantSessionFromCookies } from "@/lib/auth/tenant-session";
export default async function Page() {
  if (!await getTenantSessionFromCookies()) redirect("/login");
  return <main className="p-8"><h1>Akses menu belum diberikan</h1><p>Hubungi owner untuk mengatur akses akun ini.</p>
    <form action="/api/auth/tenant/logout" method="post"><button className="mt-4 underline">Keluar</button></form></main>;
}
