import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { NewPostPage } from "@/components/main/explore/Create";

export const metadata: Metadata = { title: "Create a post · FMD", robots: { index: false, follow: false } };

// The new-post form starts a draft with a random id, so it renders per request, not at build time (Cache Components
// stops the build on Math.random() during prerendering).
async function Form() {
  await connection();
  return <NewPostPage />;
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <Form />
    </Suspense>
  );
}
