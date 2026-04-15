import { redirect } from "next/navigation";

export default function AdminEntryPage() {
  redirect("/auth?redirect=/admin");
}
