import { getAllTables } from "@/lib/supabase/queries.server";
import TablesClient from "./TablesClient";

export default async function TablesPage() {
  const tables = await getAllTables();

  return <TablesClient tables={tables} />;
}