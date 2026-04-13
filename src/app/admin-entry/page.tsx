import { Suspense } from "react";

import AdminEntryForm from "./admin-entry-form";

export default function AdminEntryPage() {
  return (
    <main className="page-shell min-h-screen flex items-center justify-center">
      <Suspense
        fallback={
          <div className="w-full max-w-xl card relative bg-[radial-gradient(circle,rgba(180,255,57,0.05),transparent_60%),var(--bg-container)]">
            <p className="label text-(--accent)">ADMIN ENTRY</p>
            <h1 className="font-headline text-4xl md:text-5xl font-black uppercase leading-tight tracking-tight">
              LOADING ACCESS PANEL...
            </h1>
          </div>
        }
      >
        <AdminEntryForm />
      </Suspense>
    </main>
  );
}
